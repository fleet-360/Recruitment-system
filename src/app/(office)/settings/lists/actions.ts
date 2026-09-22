"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Prisma, ListKey } from "@/generated/prisma/client";

export type FormState = { error?: string; ok?: boolean; savedAt?: number } | null;

const PATH = "/settings/lists";
const EXISTS = "ערך בשם הזה כבר קיים ברשימה";

const valueSchema = z.object({
  label: z.string().trim().min(1, "יש להזין שם").max(80),
  parentId: z
    .string()
    .optional()
    .transform((v) => v || null),
});

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// A city must sit under a region; nothing else has a parent.
async function checkParent(listKey: ListKey, parentId: string | null) {
  if (listKey !== "city") return null;
  if (!parentId) return "יש לבחור אזור";
  const region = await db.lookupValue.findFirst({ where: { id: parentId, listKey: "region" } });
  return region ? null : "אזור לא תקין";
}

export async function addValue(listKey: ListKey, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!Object.values(ListKey).includes(listKey)) return { error: "רשימה לא תקינה" };
  const parsed = valueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { label, parentId } = parsed.data;
  const parentError = await checkParent(listKey, parentId);
  if (parentError) return { error: parentError };

  const last = await db.lookupValue.findFirst({ where: { listKey }, orderBy: { sortOrder: "desc" } });
  try {
    await db.lookupValue.create({
      data: { listKey, label, parentId: listKey === "city" ? parentId : null, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  } catch (e) {
    if (isDuplicate(e)) return { error: EXISTS };
    throw e;
  }
  revalidatePath(PATH);
  return { ok: true, savedAt: Date.now() };
}

export async function updateValue(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const value = await db.lookupValue.findUniqueOrThrow({ where: { id } });
  const parsed = valueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { label, parentId } = parsed.data;
  const parentError = await checkParent(value.listKey, parentId);
  if (parentError) return { error: parentError };

  try {
    await db.lookupValue.update({
      where: { id },
      data: {
        label, // history rows keep the old label text on purpose
        parentId: value.listKey === "city" ? parentId : null,
        requiresNote: value.listKey === "rejection_reason" ? formData.get("requiresNote") === "on" : false,
      },
    });
  } catch (e) {
    if (isDuplicate(e)) return { error: EXISTS };
    throw e;
  }
  revalidatePath(PATH);
  return { ok: true };
}

// Never delete — records and history keep pointing at the value.
export async function toggleActive(id: string) {
  await requireAdmin();
  const value = await db.lookupValue.findUniqueOrThrow({ where: { id } });
  await db.lookupValue.update({ where: { id }, data: { isActive: !value.isActive } });
  revalidatePath(PATH);
}

export async function move(id: string, direction: "up" | "down") {
  await requireAdmin();
  const value = await db.lookupValue.findUniqueOrThrow({ where: { id } });
  const list = await db.lookupValue.findMany({
    where: { listKey: value.listKey },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true },
  });
  const i = list.findIndex((v) => v.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];

  // Rewrite the whole order so ties (e.g. seeded 0s) can't make a move a no-op.
  await db.$transaction(list.map((v, sortOrder) => db.lookupValue.update({ where: { id: v.id }, data: { sortOrder } })));
  revalidatePath(PATH);
}

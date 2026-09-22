"use server";

import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { MAX_UPLOAD_BYTES, mimeByExt, uploadRoot } from "@/lib/uploads";
import { Prisma } from "@/generated/prisma/client";

export type FormState = { error?: string; existingId?: string; ok?: boolean } | null;

const DUPLICATE = "מועמד עם הטלפון הזה כבר קיים";

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || null);

const phone = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: "custom", message: "מספר טלפון לא תקין" });
  return p ?? "";
});

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// Form values are untrusted: a lookup id must belong to the expected list.
async function assertListValue(id: string | null, listKey: "candidate_status" | "lead_source" | "city") {
  if (id && !(await db.lookupValue.findFirst({ where: { id, listKey }, select: { id: true } }))) {
    throw new Error(`invalid ${listKey}`);
  }
}

// ───── S-03 quick entry

const quickSchema = z.object({
  fullName: z.string().trim().min(2, "יש להזין שם מלא"),
  phone,
  sourceId: optional,
  note: optional,
});

export async function createCandidate(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOffice();
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fullName, phone, sourceId, note } = parsed.data;
  await assertListValue(sourceId, "lead_source");

  const existing = await db.candidate.findUnique({ where: { phone }, select: { id: true } });
  if (existing) return { error: DUPLICATE, existingId: existing.id };

  const firstStatus = await db.lookupValue.findFirst({
    where: { listKey: "candidate_status", isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  let id: string;
  try {
    ({ id } = await db.candidate.create({
      data: {
        fullName,
        phone,
        sourceId,
        statusId: firstStatus?.id,
        ownerUserId: user.id,
        activities: note ? { create: { type: "note", body: note, userId: user.id } } : undefined,
        tasks: { create: { title: "פולואפ ראשוני", dueAt: new Date(), assignedToId: user.id } },
      },
    }));
  } catch (e) {
    if (isDuplicate(e)) return { error: DUPLICATE }; // created by someone else a moment ago
    throw e;
  }
  redirect(`/candidates/${id}`);
}

// Live duplicate warning while typing the phone.
export async function findByPhone(raw: string) {
  await requireOffice();
  const p = normalizePhone(raw);
  return p ? db.candidate.findUnique({ where: { phone: p }, select: { id: true, fullName: true } }) : null;
}

// ───── S-05 candidate card

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "יש להזין שם מלא"),
  phone,
  email: z
    .union([z.literal(""), z.email("אימייל לא תקין")])
    .optional()
    .transform((v) => v || null),
  birthDate: optional.transform((v) => (v ? new Date(v) : null)),
  cityId: optional,
  sourceId: optional,
  summary: optional,
});

export async function updateCandidate(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await assertListValue(parsed.data.cityId, "city");
  await assertListValue(parsed.data.sourceId, "lead_source");

  const languageIds = formData.getAll("languages").map(String);
  const languages = await db.lookupValue.findMany({
    where: { id: { in: languageIds }, listKey: "language" },
    select: { id: true },
  });

  try {
    await db.$transaction([
      db.candidate.update({
        where: { id },
        data: { ...parsed.data, marketingConsent: formData.get("marketingConsent") === "on" },
      }),
      db.candidateLanguage.deleteMany({ where: { candidateId: id } }),
      db.candidateLanguage.createMany({ data: languages.map((l) => ({ candidateId: id, languageId: l.id })) }),
    ]);
  } catch (e) {
    if (isDuplicate(e)) return { error: DUPLICATE };
    throw e;
  }
  revalidatePath(`/candidates/${id}`);
  return { ok: true };
}

export async function setCandidateStatus(id: string, formData: FormData) {
  const user = await requireOffice();
  const statusId = String(formData.get("statusId"));
  await assertListValue(statusId, "candidate_status");

  const current = await db.candidate.findUniqueOrThrow({ where: { id }, select: { status: true } });
  if (current.status?.id === statusId) return;
  const next = await db.lookupValue.findUniqueOrThrow({ where: { id: statusId } });

  // Status and its audit row are written together (NFR-03).
  await db.$transaction([
    db.candidate.update({ where: { id }, data: { statusId } }),
    db.activity.create({
      data: {
        candidateId: id,
        userId: user.id,
        type: "status_change",
        fromValue: current.status?.label ?? null,
        toValue: next.label,
      },
    }),
  ]);
  revalidatePath(`/candidates/${id}`);
}

export async function addNote(id: string, formData: FormData) {
  const user = await requireOffice();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await db.activity.create({ data: { candidateId: id, userId: user.id, type: "note", body } });
  revalidatePath(`/candidates/${id}`);
}

export async function uploadFile(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "לא נבחר קובץ" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "הקובץ גדול מ-10MB" };
  const ext = path.extname(file.name).toLowerCase();
  if (!mimeByExt[ext]) return { error: "סוג קובץ לא נתמך (PDF, Word או תמונה)" };
  await db.candidate.findUniqueOrThrow({ where: { id }, select: { id: true } });

  // Stored under a random name; the original name is kept only in the DB.
  const storagePath = `${id}/${randomUUID()}${ext}`;
  await mkdir(path.join(uploadRoot(), id), { recursive: true });
  await writeFile(path.join(uploadRoot(), storagePath), Buffer.from(await file.arrayBuffer()));
  await db.candidateFile.create({ data: { candidateId: id, storagePath, filename: file.name } });

  revalidatePath(`/candidates/${id}`);
  return { ok: true };
}

export async function deleteFile(fileId: string) {
  const user = await requireOffice();
  const file = await db.candidateFile.findUnique({ where: { id: fileId } });
  if (!file) return;

  // Row first, then the disk file: a leftover orphan file is harmless, a row pointing at nothing is not.
  await db.$transaction([
    db.candidateFile.delete({ where: { id: fileId } }),
    db.activity.create({
      data: { candidateId: file.candidateId, userId: user.id, type: "note", body: `נמחק קובץ: ${file.filename}` },
    }),
  ]);
  await rm(path.join(uploadRoot(), file.storagePath), { force: true });
  revalidatePath(`/candidates/${file.candidateId}`);
}

"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { tempPassword } from "@/lib/temp-password";
import { Prisma, Role } from "@/generated/prisma/client";

// tempPassword is shown to the admin once, to hand over (decided 22/09/2026: no email service yet).
export type UserFormState = { error?: string; ok?: boolean; tempPassword?: string; savedAt?: number } | null;

const PATH = "/settings/users";
const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const schema = z.object({
  name: z.string().trim().min(2, "יש להזין שם").max(80),
  email: z.email("אימייל לא תקין").transform((v) => v.toLowerCase()),
  role: z.enum(Role, "תפקיד לא תקין"),
  companyId: z
    .string()
    .optional()
    .transform((v) => v || null),
});

// Office users have no company; a company admin sees every branch of the company; a branch manager needs branches of it.
async function parse(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const data = parsed.data;
  const business = data.role === "company_admin" || data.role === "branch_manager";
  if (!business) return { data: { ...data, companyId: null }, branchIds: [] } as const;
  if (!data.companyId || !(await db.company.findUnique({ where: { id: data.companyId } }))) return { error: "יש לבחור חברה" } as const;
  if (data.role === "company_admin") return { data, branchIds: [] } as const;

  const ids = formData.getAll("branchIds").map(String);
  const branches = await db.branch.findMany({ where: { id: { in: ids }, companyId: data.companyId }, select: { id: true } });
  if (!branches.length || branches.length !== ids.length) return { error: "מנהל סניף — יש לבחור לפחות סניף אחד של החברה" } as const;
  return { data, branchIds: branches.map((b) => b.id) } as const;
}

export async function createUser(_: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();
  const p = await parse(formData);
  if ("error" in p) return { error: p.error };
  const password = tempPassword();

  try {
    await db.user.create({
      data: {
        ...p.data,
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
        branches: { create: p.branchIds.map((branchId) => ({ branchId })) },
      },
    });
  } catch (e) {
    if (isDuplicate(e)) return { error: "משתמש עם האימייל הזה כבר קיים" };
    throw e;
  }
  revalidatePath(PATH);
  return { ok: true, tempPassword: password, savedAt: Date.now() };
}

export async function updateUser(userId: string, _: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireAdmin();
  const p = await parse(formData);
  if ("error" in p) return { error: p.error };
  const isActive = formData.get("isActive") === "on";
  // an admin can't lock themselves out — so there's always at least one active admin
  if (userId === admin.id && (p.data.role !== "admin" || !isActive)) return { error: "אי אפשר להוריד הרשאת אדמין או להשבית את המשתמש שלך" };

  try {
    await db.$transaction([
      db.userBranch.deleteMany({ where: { userId } }),
      db.user.update({ where: { id: userId }, data: { ...p.data, isActive, branches: { create: p.branchIds.map((branchId) => ({ branchId })) } } }),
    ]);
  } catch (e) {
    if (isDuplicate(e)) return { error: "משתמש עם האימייל הזה כבר קיים" };
    throw e;
  }
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${userId}`);
  return { ok: true };
}

// New temporary password; the user must change it at the next login.
export async function resetPassword(userId: string): Promise<UserFormState> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "את הסיסמה שלך מחליפים ממסך החלפת סיסמה" };
  const password = tempPassword();
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } });
  return { ok: true, tempPassword: password };
}

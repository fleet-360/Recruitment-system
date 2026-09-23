"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { tempPassword } from "@/lib/temp-password";
import { Prisma } from "@/generated/prisma/client";
import type { UserFormState } from "@/app/(office)/settings/users/actions";

const PATH = "/portal/profile";

// A company admin manages the branch managers of their own company only (decided 23/09/2026). Company admins are created by the office.
async function requireCompanyAdmin() {
  const user = await requireBusiness();
  if (user.role !== "company_admin" || !user.companyId) redirect("/portal");
  return { ...user, companyId: user.companyId };
}

async function requireManager(companyId: string, userId: string) {
  const u = await db.user.findFirst({ where: { id: userId, companyId, role: "branch_manager" } });
  if (!u) throw new Error("forbidden");
  return u;
}

const schema = z.object({
  name: z.string().trim().min(2, "יש להזין שם").max(80),
  email: z.email("אימייל לא תקין").transform((v) => v.toLowerCase()),
});

export async function createBranchManager(_: UserFormState, formData: FormData): Promise<UserFormState> {
  const admin = await requireCompanyAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ids = formData.getAll("branchIds").map(String);
  const branches = await db.branch.findMany({ where: { id: { in: ids }, companyId: admin.companyId }, select: { id: true } });
  if (!branches.length || branches.length !== ids.length) return { error: "יש לבחור לפחות סניף אחד" };
  const password = tempPassword();

  try {
    await db.user.create({
      data: {
        ...parsed.data,
        role: "branch_manager",
        companyId: admin.companyId,
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
        branches: { create: branches.map((b) => ({ branchId: b.id })) },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "משתמש עם האימייל הזה כבר קיים" };
    throw e;
  }
  revalidatePath(PATH);
  return { ok: true, tempPassword: password, savedAt: Date.now() };
}

export async function toggleManagerActive(userId: string) {
  const admin = await requireCompanyAdmin();
  const u = await requireManager(admin.companyId, userId);
  await db.user.update({ where: { id: userId }, data: { isActive: !u.isActive } });
  revalidatePath(PATH);
}

export async function resetManagerPassword(userId: string): Promise<UserFormState> {
  const admin = await requireCompanyAdmin();
  await requireManager(admin.companyId, userId);
  const password = tempPassword();
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } });
  return { ok: true, tempPassword: password };
}

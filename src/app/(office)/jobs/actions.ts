"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isOffice, requireUser, type CurrentUser } from "@/lib/session";
import { canUseBranch } from "@/lib/access";
import { notifyOffice } from "@/lib/notifications";

export type FormState = { error?: string; ok?: boolean } | null;

const jobSchema = z.object({
  title: z.string().trim().min(2, "יש להזין שם משרה").max(120),
  branchId: z.string().min(1, "יש לבחור סניף"),
  description: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
  salary: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v > 0 && v < 1_000_000), "שכר לא תקין"),
  openings: z.coerce.number().int("מספר תקנים — מספר שלם").min(1, "לפחות תקן אחד").max(999),
});

// The company always comes from the branch, never from the form. Business users only use their own branches.
async function parse(user: CurrentUser, formData: FormData) {
  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const branch = await db.branch.findUnique({ where: { id: parsed.data.branchId }, select: { companyId: true } });
  if (!branch || !(await canUseBranch(user, parsed.data.branchId))) return { error: "סניף לא תקין" };
  return { data: { ...parsed.data, companyId: branch.companyId } };
}

// Office or business (own branches). A job opened in the portal is live at once and notifies the office (decided 22/09/2026).
export async function createJob(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { data, error } = await parse(user, formData);
  if (!data) return { error };
  const id = await db.$transaction(async (tx) => {
    const job = await tx.job.create({ data: { ...data, createdById: user.id }, include: { company: { select: { name: true } }, branch: { select: { name: true } } } });
    if (!isOffice(user))
      await notifyOffice(tx, [{ type: "job_opened", entityType: "job", entityId: job.id, message: `משרה חדשה מהפורטל: ${job.title} — ${job.company.name} · ${job.branch.name}` }]);
    return job.id;
  });
  revalidatePath("/portal", "layout");
  redirect(isOffice(user) ? `/jobs/${id}` : `/portal/jobs/${id}`);
}

// The job must be in an allowed branch before the edit too (parse checks the new branch).
async function requireJob(user: CurrentUser, id: string) {
  const job = await db.job.findUniqueOrThrow({ where: { id }, select: { status: true, branchId: true } });
  if (!(await canUseBranch(user, job.branchId))) throw new Error("forbidden");
  return job;
}

function refresh(id: string) {
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/portal", "layout");
}

export async function updateJob(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  await requireJob(user, id);
  const { data, error } = await parse(user, formData);
  if (!data) return { error };
  await db.job.update({ where: { id }, data });
  refresh(id);
  return { ok: true };
}

export async function toggleJobStatus(id: string) {
  const user = await requireUser();
  const job = await requireJob(user, id);
  await db.job.update({ where: { id }, data: { status: job.status === "open" ? "closed" : "open" } });
  refresh(id);
}

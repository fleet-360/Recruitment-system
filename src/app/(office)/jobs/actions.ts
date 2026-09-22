"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";

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

// The company always comes from the branch, never from the form.
async function parse(formData: FormData) {
  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const branch = await db.branch.findUnique({ where: { id: parsed.data.branchId }, select: { companyId: true } });
  if (!branch) return { error: "סניף לא תקין" };
  return { data: { ...parsed.data, companyId: branch.companyId } };
}

// ponytail: office only for now; the business portal (task 19) opens jobs in its own branches + notifies the office.
export async function createJob(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOffice();
  const { data, error } = await parse(formData);
  if (!data) return { error };
  const { id } = await db.job.create({ data: { ...data, createdById: user.id } });
  redirect(`/jobs/${id}`);
}

export async function updateJob(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const { data, error } = await parse(formData);
  if (!data) return { error };
  await db.job.update({ where: { id }, data });
  revalidatePath(`/jobs/${id}`);
  return { ok: true };
}

export async function toggleJobStatus(id: string) {
  await requireOffice();
  const job = await db.job.findUniqueOrThrow({ where: { id }, select: { status: true } });
  await db.job.update({ where: { id }, data: { status: job.status === "open" ? "closed" : "open" } });
  revalidatePath(`/jobs/${id}`);
}

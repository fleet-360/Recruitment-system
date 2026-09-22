"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { termsError, type FeeType } from "@/lib/fees";

export type FormState = { error?: string; ok?: boolean; savedAt?: number } | null;

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || null);

const companySchema = z.object({
  name: z.string().trim().min(2, "יש להזין שם חברה").max(120),
  regNumber: optional,
  notes: optional,
});

async function assertCity(id: string | null) {
  if (id && !(await db.lookupValue.findFirst({ where: { id, listKey: "city" }, select: { id: true } }))) throw new Error("invalid city");
}

// ───── S-07 new company — always starts with one branch, since jobs hang off a branch (decided 22/09/2026)

export async function createCompany(_: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cityId = String(formData.get("cityId") ?? "") || null;
  await assertCity(cityId);

  const { id } = await db.company.create({
    data: { ...parsed.data, branches: { create: { name: "ראשי", cityId } } },
  });
  redirect(`/companies/${id}`);
}

// ───── S-08 company card

export async function updateCompany(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.company.update({ where: { id }, data: parsed.data });
  revalidatePath(`/companies/${id}`);
  return { ok: true };
}

const branchSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם סניף").max(80),
  cityId: optional,
  address: optional,
  feeType: z.enum(["", "fixed", "percent_of_salary"]).optional().transform((v) => (v || null) as FeeType | null),
  feeValue: optional.transform((v) => (v ? Number(v) : 0)),
});

// Branch details + its payment terms in one save. branchId null = new branch.
export async function saveBranch(companyId: string, branchId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const parsed = branchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { feeType, feeValue, ...details } = parsed.data;
  await assertCity(details.cityId);

  const days = formData.getAll("days").map(Number);
  const rows = formData
    .getAll("share")
    .map((s, i) => ({ sharePercent: Number(s), daysAfterStart: days[i] }))
    .sort((a, b) => a.daysAfterStart - b.daysAfterStart);
  if (feeType) {
    const error = termsError(feeType, feeValue, rows);
    if (error) return { error };
  }
  const fee = feeType ? { feeType, feeValue } : { feeType: null, feeValue: null };

  // ponytail: terms changes aren't in the audit log (Activity is per candidate); add a company-level log if the client asks who changed a fee.
  await db.$transaction(async (tx) => {
    const branch = branchId
      ? await tx.branch.update({ where: { id: branchId, companyId }, data: { ...details, ...fee } })
      : await tx.branch.create({ data: { companyId, ...details, ...fee } });
    await tx.paymentTerm.deleteMany({ where: { branchId: branch.id } });
    if (feeType) await tx.paymentTerm.createMany({ data: rows.map((r, i) => ({ branchId: branch.id, seq: i + 1, ...r })) });
  });
  revalidatePath(`/companies/${companyId}`);
  return { ok: true, savedAt: Date.now() };
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "יש להזין שם איש קשר").max(80),
  role: optional,
  phone: optional.transform((v, ctx) => {
    if (!v) return null;
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "מספר טלפון לא תקין" });
    return p;
  }),
  email: z
    .union([z.literal(""), z.email("אימייל לא תקין")])
    .optional()
    .transform((v) => v || null),
  branchId: optional,
});

// contactId null = new contact.
export async function saveContact(companyId: string, contactId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireOffice();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.branchId && !(await db.branch.findFirst({ where: { id: data.branchId, companyId }, select: { id: true } }))) {
    return { error: "סניף לא תקין" };
  }
  if (contactId) await db.contact.update({ where: { id: contactId, companyId }, data });
  else await db.contact.create({ data: { ...data, companyId } });
  revalidatePath(`/companies/${companyId}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteContact(contactId: string) {
  await requireOffice();
  const contact = await db.contact.delete({ where: { id: contactId } });
  revalidatePath(`/companies/${contact.companyId}`);
}

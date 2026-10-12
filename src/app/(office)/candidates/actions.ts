"use server";

import path from "node:path";
import { rm } from "node:fs/promises";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireOffice } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { today } from "@/lib/fees";
import { saveCandidateFile, uploadRoot, uploadsDisabled, validateUpload } from "@/lib/uploads";
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
  cityId: optional,
  sourceId: optional,
  previousExperience: optional,
  note: optional,
});

export async function createCandidate(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOffice();
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fullName, phone, cityId, sourceId, previousExperience, note } = parsed.data;
  await assertListValue(cityId, "city");
  await assertListValue(sourceId, "lead_source");

  // Optional CV upload (task 31): validated up front so a bad file doesn't silently get dropped.
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && !uploadsDisabled()) {
    const error = validateUpload(file as File);
    if (error) return { error };
  }

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
        cityId,
        sourceId,
        previousExperience,
        statusId: firstStatus?.id,
        ownerUserId: user.id,
        activities: note ? { create: { type: "note", body: note, userId: user.id } } : undefined,
        tasks: { create: { title: "פולואפ ראשוני", dueAt: today(), assignedToId: user.id } },
      },
    }));
  } catch (e) {
    if (isDuplicate(e)) return { error: DUPLICATE }; // created by someone else a moment ago
    throw e;
  }
  if (hasFile && !uploadsDisabled()) await saveCandidateFile(id, file as File);
  redirect(`/candidates/${id}`);
}

// Live duplicate warning while typing the phone.
export async function findByPhone(raw: string) {
  await requireOffice();
  const p = normalizePhone(raw);
  return p ? db.candidate.findUnique({ where: { phone: p }, select: { id: true, fullName: true } }) : null;
}

// ───── S-05 candidate card

const age = optional.transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v > 0 && v < 120), "גיל לא תקין");

const detailsSchema = z.object({
  fullName: z.string().trim().min(2, "יש להזין שם מלא"),
  phone,
  email: z
    .union([z.literal(""), z.email("אימייל לא תקין")])
    .optional()
    .transform((v) => v || null),
  birthDate: optional.transform((v) => (v ? new Date(v) : null)),
  age,
  idNumber: optional,
  cityId: optional,
  sourceId: optional,
  previousExperience: optional,
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

  // task 31: age is derived from birthDate when it's known — only stored when birthDate is empty.
  const data = { ...parsed.data, age: parsed.data.birthDate ? null : parsed.data.age };

  try {
    await db.$transaction([
      db.candidate.update({
        where: { id },
        data: { ...data, marketingConsent: formData.get("marketingConsent") === "on" },
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
  if (uploadsDisabled()) return { error: "העלאת קבצים לא זמינה בסביבה הזו" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "לא נבחר קובץ" };
  const error = validateUpload(file);
  if (error) return { error };
  await db.candidate.findUniqueOrThrow({ where: { id }, select: { id: true } });

  // Stored under a random name; the original name is kept only in the DB.
  await saveCandidateFile(id, file);

  revalidatePath(`/candidates/${id}`);
  return { ok: true };
}

// Right to erasure (NFR-02, decided 23/09/2026): admin wipes the candidate's personal data but keeps the row,
// so placements, installments and reports stay correct. Free text that may describe the person goes too.
export async function anonymizeCandidate(id: string) {
  const user = await requireAdmin();
  const c = await db.candidate.findUniqueOrThrow({
    where: { id },
    select: { anonymizedAt: true, placements: { select: { id: true, installments: { select: { id: true } } } } },
  });
  if (c.anonymizedAt) return;
  const entityIds = c.placements.flatMap((p) => [p.id, ...p.installments.map((i) => i.id)]);

  await db.$transaction([
    db.candidate.update({
      where: { id },
      data: {
        fullName: "מועמד שנמחק",
        phone: `deleted-${id}`,
        email: null,
        birthDate: null,
        age: null,
        idNumber: null,
        cityId: null,
        previousExperience: null,
        summary: null,
        marketingConsent: false,
        anonymizedAt: new Date(),
      },
    }),
    db.candidateLanguage.deleteMany({ where: { candidateId: id } }),
    db.candidateFile.deleteMany({ where: { candidateId: id } }),
    db.activity.deleteMany({ where: { candidateId: id, type: { in: ["note", "call", "whatsapp"] } } }),
    db.activity.updateMany({ where: { candidateId: id, type: "status_change" }, data: { body: null } }),
    db.placement.updateMany({ where: { candidateId: id }, data: { rejectionNote: null, endReason: null } }),
    db.task.deleteMany({ where: { candidateId: id } }),
    db.notification.deleteMany({ where: { entityId: { in: entityIds } } }), // messages carry the name
    db.lead.updateMany({ where: { candidateId: id }, data: { fullName: null, phone: null, raw: {} } }),
    db.activity.create({ data: { candidateId: id, userId: user.id, type: "note", body: "הנתונים האישיים נמחקו לבקשת המועמד" } }),
  ]);
  await rm(path.join(uploadRoot(), id), { recursive: true, force: true });
  revalidatePath(`/candidates/${id}`);
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

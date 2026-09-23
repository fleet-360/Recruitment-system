"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { isOffice, requireOffice, requireUser, type CurrentUser } from "@/lib/session";
import { canUseBranch } from "@/lib/access";
import { notifyOffice } from "@/lib/notifications";
import { cancelledBy, planInstallments, today, type FeeType } from "@/lib/fees";
import { Prisma } from "@/generated/prisma/client";

export type FormState = { error?: string; warning?: string; ok?: boolean } | null;
type Tx = Prisma.TransactionClient;

const shekel = (n: number) => `${n.toLocaleString("he-IL")} ₪`;
const installments = (n: number) => (n === 1 ? "פעימה אחת" : `${n} פעימות`);
const date = (d: Date) => d.toLocaleDateString("he-IL", { timeZone: "UTC" });

// Every page that shows a placement drawer.
function refresh(p: { jobId: string; candidateId: string }) {
  revalidatePath("/collections");
  revalidatePath(`/jobs/${p.jobId}`);
  revalidatePath(`/candidates/${p.candidateId}`);
  revalidatePath("/portal", "layout");
}

// Status, reject and fire are open to business users in their own branches (decided 23/09/2026);
// start date / salary stay office-only. Business changes notify the office.
async function requirePlacement(placementId: string) {
  const user = await requireUser();
  const p = await db.placement.findUniqueOrThrow({
    where: { id: placementId },
    include: { status: true, candidate: { select: { fullName: true } }, job: { select: { branchId: true, title: true, company: { select: { name: true } } } } },
  });
  if (!(await canUseBranch(user, p.job.branchId))) throw new Error("forbidden");
  return { user, p };
}

type Loaded = Awaited<ReturnType<typeof requirePlacement>>["p"];
async function notifyIfBusiness(tx: Tx, user: CurrentUser, p: Loaded, what: string) {
  if (isOffice(user)) return;
  await notifyOffice(tx, [{
    type: "placement_status", entityType: "placement", entityId: p.id,
    message: `${p.job.company.name}: ${p.candidate.fullName} · ${p.job.title} — ${what} (עודכן בפורטל ע״י ${user.name ?? user.email})`,
  }]);
}

const systemStatus = (tx: Tx, systemKey: "rejected" | "fired") =>
  tx.lookupValue.findUniqueOrThrow({ where: { listKey_systemKey: { listKey: "placement_status", systemKey } } });

// Cancels open installments due after the cutoff; returns how many.
async function cancelAfter(tx: Tx, placementId: string, cutoff: Date) {
  const open = await tx.installment.findMany({ where: { placementId, status: "expected" } });
  const ids = open.filter((i) => cancelledBy(i.dueDate, cutoff)).map((i) => i.id);
  if (ids.length) await tx.installment.updateMany({ where: { id: { in: ids } }, data: { status: "cancelled" } });
  return ids.length;
}

// ───── S-10 assign a candidate to a job → placement at the first process step

export async function assignCandidate(jobId: string, candidateId: string) {
  const user = await requireOffice();
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
  if (job.status !== "open") throw new Error("job is closed");
  const first = await db.lookupValue.findFirstOrThrow({
    where: { listKey: "placement_status", isActive: true, systemKey: null },
    orderBy: { sortOrder: "asc" },
  });

  try {
    await db.placement.create({
      data: {
        jobId,
        candidateId,
        statusId: first.id,
        activities: { create: { candidateId, userId: user.id, type: "status_change", toValue: first.label } },
      },
    });
  } catch (e) {
    // already assigned (double click / someone else) — nothing to do
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  refresh({ jobId, candidateId });
}

// ───── S-11 process status. Rejected / fired have their own actions (reason, date).
// Moving a rejected / fired placement back to a normal step reopens it: its cancelled installments come back.

export async function setPlacementStatus(placementId: string, formData: FormData) {
  const { user, p } = await requirePlacement(placementId);
  const statusId = String(formData.get("statusId"));
  const next = await db.lookupValue.findFirstOrThrow({ where: { id: statusId, listKey: "placement_status", systemKey: null } });
  if (p.statusId === statusId) return;
  const reopen = !!p.status?.systemKey;

  await db.$transaction(async (tx) => {
    await tx.placement.update({
      where: { id: placementId },
      data: { statusId, ...(reopen && { rejectionReasonId: null, rejectionNote: null, endDate: null, endReason: null }) },
    });
    await tx.activity.create({
      data: { candidateId: p.candidateId, placementId, userId: user.id, type: "status_change", fromValue: p.status?.label ?? null, toValue: next.label },
    });
    if (reopen) {
      const { count } = await tx.installment.updateMany({ where: { placementId, status: "cancelled" }, data: { status: "expected" } });
      if (count) await tx.activity.create({ data: { candidateId: p.candidateId, placementId, userId: user.id, type: "billing", body: `ההשמה נפתחה מחדש — ${installments(count)} חזרו לצפוי` } });
    }
    await notifyIfBusiness(tx, user, p, next.label);
  });
  refresh(p);
}

const rejectSchema = z.object({
  rejectionReasonId: z.string().min(1, "יש לבחור סיבת דחייה"),
  rejectionNote: z
    .string()
    .optional()
    .transform((v) => v?.trim() || null),
});

export async function rejectPlacement(placementId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { user, p } = await requirePlacement(placementId);
  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { rejectionReasonId, rejectionNote } = parsed.data;
  const reason = await db.lookupValue.findFirst({ where: { id: rejectionReasonId, listKey: "rejection_reason" } });
  if (!reason) return { error: "סיבת דחייה לא תקינה" };
  if (reason.requiresNote && !rejectionNote) return { error: "יש לפרט את סיבת הדחייה" };

  await db.$transaction(async (tx) => {
    const rejected = await systemStatus(tx, "rejected");
    await tx.placement.update({ where: { id: placementId }, data: { statusId: rejected.id, rejectionReasonId, rejectionNote, endDate: null, endReason: null } });
    await tx.activity.create({
      data: {
        candidateId: p.candidateId, placementId, userId: user.id, type: "status_change",
        fromValue: p.status?.label ?? null, toValue: rejected.label, body: [reason.label, rejectionNote].filter(Boolean).join(" — "),
      },
    });
    const cancelled = await cancelAfter(tx, placementId, today());
    if (cancelled) await tx.activity.create({ data: { candidateId: p.candidateId, placementId, userId: user.id, type: "billing", body: `בוטלו פעימות עתידיות (דחייה): ${installments(cancelled)}` } });
    await notifyIfBusiness(tx, user, p, `${rejected.label}: ${[reason.label, rejectionNote].filter(Boolean).join(" — ")}`);
  });
  refresh(p);
  return { ok: true };
}

const fireSchema = z.object({
  endDate: z.iso.date("יש להזין תאריך סיום").transform((v) => new Date(v)),
  endReason: z.string().trim().min(2, "יש לפרט את סיבת הסיום"),
});

export async function firePlacement(placementId: string, _: FormState, formData: FormData): Promise<FormState> {
  const { user, p } = await requirePlacement(placementId);
  const parsed = fireSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { endDate, endReason } = parsed.data;
  if (!p.startDate) return { error: "אין תאריך התחלה — אם העובד לא התחיל לעבוד, סמנו דחייה" };
  if (endDate < p.startDate) return { error: "תאריך הסיום לפני תאריך ההתחלה" };

  await db.$transaction(async (tx) => {
    const fired = await systemStatus(tx, "fired");
    await tx.placement.update({ where: { id: placementId }, data: { statusId: fired.id, endDate, endReason, rejectionReasonId: null, rejectionNote: null } });
    await tx.activity.create({
      data: { candidateId: p.candidateId, placementId, userId: user.id, type: "status_change", fromValue: p.status?.label ?? null, toValue: fired.label, body: `${date(endDate)} — ${endReason}` },
    });
    const cancelled = await cancelAfter(tx, placementId, endDate);
    if (cancelled) await tx.activity.create({ data: { candidateId: p.candidateId, placementId, userId: user.id, type: "billing", body: `בוטלו פעימות שמועדן אחרי ${date(endDate)}: ${installments(cancelled)}` } });
    await notifyIfBusiness(tx, user, p, `${fired.label} ב-${date(endDate)}: ${endReason}`);
  });
  refresh(p);
  return { ok: true };
}

// ───── Start date + salary → installments (REQ-15)

const startSchema = z.object({
  startDate: z.iso.date("יש להזין תאריך התחלה").transform((v) => new Date(v)),
  salary: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v > 0 && v < 1_000_000), "שכר לא תקין"),
});

// First save copies the branch terms onto the placement and creates the installments.
// Later saves recalculate only the open installments from that copy — paid and cancelled ones don't change.
export async function saveStart(placementId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOffice();
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { startDate, salary } = parsed.data;

  const p = await db.placement.findUniqueOrThrow({
    where: { id: placementId },
    include: {
      status: true,
      installments: { orderBy: { seq: "asc" } },
      job: { select: { branch: { include: { paymentTerms: { orderBy: { seq: "asc" } } } } } },
    },
  });
  if (p.status?.systemKey) return { error: "ההשמה נדחתה / הסתיימה — יש להחזיר אותה לשלב פעיל קודם" };
  if (p.endDate && startDate > p.endDate) return { error: "תאריך ההתחלה אחרי תאריך הסיום" };

  const snapshot = p.installments.length > 0;
  const branch = p.job.branch;
  const feeType = (snapshot ? p.feeType : branch.feeType) as FeeType | null;
  const feeValue = Number(snapshot ? p.feeValue : branch.feeValue);
  const rows = (snapshot ? p.installments : branch.paymentTerms).map((t) => ({ sharePercent: Number(t.sharePercent), daysAfterStart: t.daysAfterStart }));

  if (!feeType) {
    await db.placement.update({ where: { id: placementId }, data: { startDate, salary } });
    refresh(p);
    return { ok: true, warning: "לסניף אין תנאי תשלום — לא נוצרו פעימות" };
  }
  const plan = planInstallments(startDate, feeType, feeValue, salary, rows);
  if (!plan) return { error: "העמלה באחוז משכר — יש להזין שכר" };
  const total = plan.reduce((s, i) => s + i.amount, 0);

  await db.$transaction(async (tx) => {
    await tx.placement.update({ where: { id: placementId }, data: { startDate, salary, ...(!snapshot && { feeType, feeValue }) } });
    if (!snapshot) {
      await tx.installment.createMany({ data: plan.map((i) => ({ placementId, ...i })) });
      await tx.activity.create({ data: { candidateId: p.candidateId, placementId, userId: user.id, type: "billing", body: `נוצרו ${installments(plan.length)}, סה״כ ${shekel(total)}` } });
      return;
    }
    const open = p.installments.filter((i) => i.status === "expected");
    for (const i of open) {
      const next = plan[i.seq - 1];
      await tx.installment.update({ where: { id: i.id }, data: { dueDate: next.dueDate, amount: next.amount } });
    }
    const changed = open.some((i) => i.dueDate.getTime() !== plan[i.seq - 1].dueDate.getTime() || Number(i.amount) !== plan[i.seq - 1].amount);
    if (changed) await tx.activity.create({ data: { candidateId: p.candidateId, placementId, userId: user.id, type: "billing", body: `חושבו מחדש פעימות פתוחות: ${installments(open.length)} (תאריך התחלה ${date(startDate)}${salary ? `, שכר ${shekel(salary)}` : ""})` } });
  });
  refresh(p);
  return { ok: true };
}

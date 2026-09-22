"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { today } from "@/lib/fees";

export type PaidState = { error?: string } | null;

const shekel = (n: unknown) => `${Number(n).toLocaleString("he-IL")} ₪`;
const date = (d: Date) => d.toLocaleDateString("he-IL", { timeZone: "UTC" });

function refresh(i: { placement: { jobId: string; candidateId: string } }) {
  revalidatePath("/collections");
  revalidatePath(`/jobs/${i.placement.jobId}`);
  revalidatePath(`/candidates/${i.placement.candidateId}`);
}

const paidSchema = z.object({
  paidAt: z.iso.date("יש להזין תאריך תשלום").transform((v) => new Date(v)),
});

// REQ-16: only the office marks an installment paid. Full payments only (decided 22/09/2026).
export async function markPaid(installmentId: string, _: PaidState, formData: FormData): Promise<PaidState> {
  const user = await requireOffice();
  const parsed = paidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { paidAt } = parsed.data;
  if (paidAt > today()) return { error: "תאריך התשלום בעתיד" };

  const i = await db.installment.findUniqueOrThrow({ where: { id: installmentId }, include: { placement: { select: { jobId: true, candidateId: true } } } });
  const done = await db.$transaction(async (tx) => {
    // status in the where: a double click or a cancel in the meantime doesn't mark it twice
    const { count } = await tx.installment.updateMany({ where: { id: installmentId, status: "expected" }, data: { status: "paid", paidAt } });
    if (count) {
      await tx.activity.create({
        data: { candidateId: i.placement.candidateId, placementId: i.placementId, userId: user.id, type: "billing", body: `פעימה ${i.seq} סומנה כשולמה (${date(paidAt)}) — ${shekel(i.amount)}` },
      });
    }
    return count > 0;
  });
  if (!done) return { error: "הפעימה כבר לא פתוחה — רעננו את הדף" };
  refresh(i);
  return null;
}

// Undo a mistaken "paid" — the installment goes back to expected.
export async function unmarkPaid(installmentId: string) {
  const user = await requireOffice();
  const i = await db.installment.findUniqueOrThrow({ where: { id: installmentId }, include: { placement: { select: { jobId: true, candidateId: true } } } });
  await db.$transaction(async (tx) => {
    const { count } = await tx.installment.updateMany({ where: { id: installmentId, status: "paid" }, data: { status: "expected", paidAt: null } });
    if (count) {
      await tx.activity.create({
        data: { candidateId: i.placement.candidateId, placementId: i.placementId, userId: user.id, type: "billing", body: `בוטל סימון תשלום לפעימה ${i.seq} — ${shekel(i.amount)}` },
      });
    }
  });
  refresh(i);
}

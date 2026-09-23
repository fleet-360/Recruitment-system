import type { Prisma } from "@/generated/prisma/client";
import { today } from "./fees";

type Client = Prisma.TransactionClient; // the db client or a transaction — the demo seed passes its own client
type Note = { type: "installment_overdue" | "job_opened" | "placement_status"; entityType: "installment" | "job" | "placement"; entityId: string; message: string };

// One row per active office user (admins + recruiters) — a small office that covers for each other (decided 23/09/2026).
export async function notifyOffice(db: Client, notes: Note[]) {
  if (!notes.length) return 0;
  const users = await db.user.findMany({ where: { isActive: true, role: { in: ["admin", "recruiter"] } }, select: { id: true } });
  await db.notification.createMany({ data: notes.flatMap((n) => users.map((u) => ({ ...n, userId: u.id }))) });
  return notes.length;
}

export const notificationHref = (n: { entityType: string; entityId: string }) =>
  n.entityType === "job" ? `/jobs/${n.entityId}` : n.entityType === "placement" ? `/placements/${n.entityId}` : "/collections?tab=late";

// Daily job: notify once per installment that became overdue (expected + due date passed).
// "Overdue" itself is derived on read, so there is nothing to mark. Idempotent — safe to run any number of times.
export async function notifyOverdue(db: Client) {
  const notified = await db.notification.findMany({ where: { type: "installment_overdue" }, distinct: ["entityId"], select: { entityId: true } });
  const late = await db.installment.findMany({
    where: { status: "expected", dueDate: { lt: today() }, id: { notIn: notified.map((n) => n.entityId) } },
    include: { placement: { select: { candidate: { select: { fullName: true } }, job: { select: { company: { select: { name: true } } } } } } },
    orderBy: { dueDate: "asc" },
  });
  return notifyOffice(
    db,
    late.map((i) => ({
      type: "installment_overdue",
      entityType: "installment",
      entityId: i.id,
      message: `פעימה ${i.seq} באיחור — ${i.placement.job.company.name} · ${i.placement.candidate.fullName} · ${Number(i.amount).toLocaleString("he-IL")} ₪ (מועד ${i.dueDate.toLocaleDateString("he-IL", { timeZone: "UTC" })})`,
    })),
  );
}

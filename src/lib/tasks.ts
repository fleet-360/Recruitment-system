import type { Prisma } from "@/generated/prisma/client";
import { addDays, today } from "./fees";

type Client = Prisma.TransactionClient;

// Tasks are date-only (decided 23/09/2026): dueAt is UTC midnight of the Israeli date, like @db.Date columns.
export const BUCKETS = { today: "היום", late: "באיחור", upcoming: "עתידי", done: "בוצעו" } as const;
export type Bucket = keyof typeof BUCKETS;

export function bucketWhere(b: Bucket, now = today()): Prisma.TaskWhereInput {
  if (b === "done") return { doneAt: { not: null } };
  const dueAt = { late: { lt: now }, today: { gte: now, lt: addDays(now, 1) }, upcoming: { gte: addDays(now, 1) } }[b];
  return { doneAt: null, dueAt };
}

// Daily job: one collection task per late installment (decided 23/09/2026), for the candidate's recruiter —
// or the first admin when the candidate has none. Idempotent: Task.installmentId is unique, and a task marked
// done isn't reopened while the installment stays late.
export async function openOverdueTasks(db: Client) {
  const late = await db.installment.findMany({
    where: { status: "expected", dueDate: { lt: today() }, task: null },
    include: {
      placement: {
        select: {
          candidateId: true,
          candidate: { select: { owner: { select: { id: true, isActive: true, role: true } } } },
          job: { select: { company: { select: { name: true } } } },
        },
      },
    },
  });
  if (!late.length) return 0;
  const admin = await db.user.findFirst({ where: { role: "admin", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });

  const data = late.flatMap((i) => {
    const owner = i.placement.candidate.owner;
    const assignedToId = owner?.isActive && (owner.role === "admin" || owner.role === "recruiter") ? owner.id : admin?.id;
    if (!assignedToId) return [];
    return [{ installmentId: i.id, candidateId: i.placement.candidateId, assignedToId, dueAt: today(), title: `גבייה: פעימה ${i.seq} — ${i.placement.job.company.name}` }];
  });
  const { count } = await db.task.createMany({ data, skipDuplicates: true }); // skipDuplicates: two runs at once
  return count;
}

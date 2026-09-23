import Link from "next/link";
import { Circle, CircleCheck } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { setTaskDone } from "./actions";

// Assignee choices: active office users (admins + recruiters).
export const officeUsers = () =>
  db.user
    .findMany({ where: { isActive: true, role: { in: ["admin", "recruiter"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })
    .then((us) => us.map((u) => ({ id: u.id, label: u.name ?? u.email })));

export const taskInclude = {
  candidate: { select: { id: true, fullName: true } },
  assignedTo: { select: { name: true, email: true } },
} satisfies Prisma.TaskInclude;
type Row = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export const dueLabel = (d: Date) => d.toLocaleDateString("he-IL", { timeZone: "UTC", weekday: "short", day: "numeric", month: "numeric" });

// Circle → done, check → reopen. Plain server-action form, no client JS.
export function DoneToggle({ task }: { task: { id: string; doneAt: Date | null } }) {
  return (
    <form action={setTaskDone.bind(null, task.id, !task.doneAt)} className="flex">
      <button title={task.doneAt ? "החזרה לפתוחות" : "סימון בוצע"} aria-label={task.doneAt ? "החזרה לפתוחות" : "סימון בוצע"}>
        {task.doneAt ? <CircleCheck size={22} className="text-emerald-500" /> : <Circle size={22} className="text-slate-300 hover:text-emerald-500" />}
      </button>
    </form>
  );
}

// Compact list for the dashboard and the candidate card.
export function TaskItems({ tasks, now, showCandidate = true }: { tasks: Row[]; now: Date; showCandidate?: boolean }) {
  return (
    <ul className="space-y-1 text-sm">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-3 rounded-xl bg-white/60 p-2.5">
          <DoneToggle task={t} />
          <div className="min-w-0 flex-1">
            <p className={t.doneAt ? "text-slate-400 line-through" : "font-medium"}>{t.title}</p>
            <p className="truncate text-xs text-slate-500">
              {showCandidate && t.candidate && <Link href={`/candidates/${t.candidate.id}`} className="text-violet-700 hover:underline">{t.candidate.fullName}</Link>}
              {showCandidate && t.candidate && " · "}
              {t.assignedTo.name ?? t.assignedTo.email}
            </p>
          </div>
          <span className={`text-xs whitespace-nowrap ${!t.doneAt && t.dueAt < now ? "font-bold text-red-600" : "text-slate-500"}`}>{dueLabel(t.dueAt)}</span>
        </li>
      ))}
    </ul>
  );
}

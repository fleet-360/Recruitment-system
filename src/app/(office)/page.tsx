import Link from "next/link";
import { AlarmClock, BriefcaseBusiness, CircleCheck, Hourglass, ListTodo, UserPlus, Users, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { addDays, israelMidnight, today } from "@/lib/fees";
import { addMonths, parseMonth } from "@/lib/month";
import { processSteps } from "../portal/data";
import { openNotification } from "./notification-actions";
import { TaskItems, taskInclude } from "./tasks/data";

const shekel = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

// S-02 office home: KPIs, my tasks for today (+ late), jobs businesses opened that I haven't seen, quick add.
// KPIs count placements (decided 23/09/2026): "in process" = not rejected / fired / hired for good,
// "hired this month" = start date this month — the date that creates the installments.
export default async function Home() {
  const user = await requireOffice();
  const now = today();
  const month = parseMonth(undefined, now);
  const thisMonth = { gte: month, lt: addMonths(month, 1) };
  const hiredId = (await processSteps()).at(-1)?.id;

  const [newToday, active, hired, due, late, tasks, newJobs] = await Promise.all([
    db.candidate.count({ where: { createdAt: { gte: israelMidnight() } } }),
    db.placement.count({ where: { OR: [{ statusId: null }, { status: { systemKey: null, id: { not: hiredId } } }] } }),
    // null-safe on purpose: NOT { systemKey: "rejected" } is SQL NULL for regular statuses (systemKey null) and drops them
    db.placement.count({ where: { startDate: thisMonth, OR: [{ statusId: null }, { status: { systemKey: null } }, { status: { systemKey: { not: "rejected" } } }] } }),
    db.installment.aggregate({ where: { status: { not: "cancelled" }, dueDate: thisMonth }, _sum: { amount: true } }),
    db.installment.aggregate({ where: { status: "expected", dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
    db.task.findMany({ where: { assignedToId: user.id, doneAt: null, dueAt: { lt: addDays(now, 1) } }, include: taskInclude, orderBy: [{ dueAt: "asc" }, { title: "asc" }], take: 30 }),
    // "unseen" = my unread job_opened notification; opening it here marks it read, same as the bell
    db.notification.findMany({ where: { userId: user.id, type: "job_opened", readAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const kpis = [
    { label: "חדשים היום", value: newToday, href: "/candidates", Icon: UserPlus, tone: "bg-accent-gradient" },
    { label: "השמות בתהליך", value: active, href: "/jobs", Icon: Hourglass, tone: "bg-primary-gradient" },
    { label: "התחילו לעבוד החודש", value: hired, href: "/jobs", Icon: CircleCheck, tone: "bg-emerald-500" },
    { label: "לגבייה החודש", value: shekel(Number(due._sum.amount ?? 0)), href: "/collections", Icon: Wallet, tone: "bg-accent-gradient" },
    { label: `באיחור (${late._count})`, value: shekel(Number(late._sum.amount ?? 0)), href: "/collections?tab=late", Icon: AlarmClock, tone: late._count ? "bg-red-500" : "bg-slate-300" },
  ];

  return (
    <>
      <section className="glass p-6">
        <h1 className="text-2xl font-bold">שלום, {user.name ?? user.email}</h1>
        <p className="text-slate-500">
          {now.toLocaleDateString("he-IL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })} · {tasks.length ? `${tasks.length} משימות מחכות לך` : "אין משימות פתוחות להיום"}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-5">
        {kpis.map(({ label, value, href, Icon, tone }) => (
          <Link key={label} href={href} className="glass flex flex-col gap-2 p-3 last:col-span-2 hover:shadow-lg sm:p-5 md:last:col-span-1">
            <span className={`${tone} flex size-9 items-center justify-center rounded-xl text-white`}><Icon size={18} /></span>
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-2xl font-bold">{value}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="glass space-y-3 p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold"><ListTodo size={18} className="text-violet-500" /> המשימות שלי להיום</h2>
            <Link href="/tasks" className="text-sm text-violet-700 hover:underline">כל המשימות</Link>
          </div>
          {tasks.length ? <TaskItems tasks={tasks} now={now} /> : <p className="py-6 text-center text-sm text-slate-500">אין משימות להיום 🎉</p>}
        </section>

        <div className="space-y-4 lg:col-span-2">
          {newJobs.length > 0 && (
            <section className="glass space-y-3 p-5">
              <h2 className="flex items-center gap-2 font-bold"><BriefcaseBusiness size={18} className="text-violet-500" /> משרות חדשות מעסקים</h2>
              <ul className="space-y-1">
                {newJobs.map((n) => (
                  <li key={n.id}>
                    <form action={openNotification.bind(null, n.id)}>
                      <button className="w-full rounded-xl bg-violet-50 p-2.5 text-start text-sm hover:bg-white/70">
                        {n.message}
                        <span className="block text-xs text-slate-400">{n.createdAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" })}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/candidates?new=1" className="glass flex flex-col items-center gap-2 p-8 text-center hover:shadow-lg">
            <Users size={40} className="text-emerald-500" />
            <span className="text-lg font-bold">קליטת מועמד חדש</span>
            <span className="text-sm text-slate-500">שם, טלפון ומקור — פחות מ-30 שניות</span>
          </Link>
        </div>
      </div>
    </>
  );
}

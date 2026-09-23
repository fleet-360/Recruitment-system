import Link from "next/link";
import { ListTodo } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { dayKey } from "@/lib/month";
import { today } from "@/lib/fees";
import { BUCKETS, bucketWhere, type Bucket } from "@/lib/tasks";
import { DoneToggle, dueLabel, officeUsers, taskInclude } from "./data";
import { TaskForm } from "./task-form";

const EMPTY: Record<Bucket, string> = { today: "אין משימות להיום", late: "אין משימות באיחור", upcoming: "אין משימות עתידיות", done: "עדיין לא סומנו משימות" };

// S-13 tasks: mine / everyone's, by today · late · upcoming (+ done, to undo a mistaken click).
export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireOffice();
  const sp = await searchParams;
  const who = sp.who === "all" ? "all" : "mine";
  const tab = (typeof sp.tab === "string" && Object.hasOwn(BUCKETS, sp.tab) ? sp.tab : "today") as Bucket;
  const now = today();
  const scope = who === "mine" ? { assignedToId: user.id } : {};
  const open = (["today", "late", "upcoming"] as const);

  const [counts, rows, users] = await Promise.all([
    Promise.all(open.map((b) => db.task.count({ where: { ...scope, ...bucketWhere(b, now) } }))),
    db.task.findMany({
      where: { ...scope, ...bucketWhere(tab, now) },
      include: taskInclude,
      orderBy: tab === "done" ? { doneAt: "desc" } : [{ dueAt: "asc" }, { title: "asc" }],
      take: 200, // ponytail: no pagination, add when a tab passes a couple of hundred tasks
    }),
    officeUsers(),
  ]);
  const count = Object.fromEntries(open.map((b, i) => [b, counts[i]])) as Record<Bucket, number>;
  const href = (q: { who?: string; tab?: string }) => `/tasks?${new URLSearchParams({ who, tab, ...q })}`;
  const pill = (active: boolean) => `rounded-full px-4 py-2 text-sm ${active ? "bg-primary-gradient text-white" : "glass text-slate-600"}`;

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <ListTodo size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">משימות</h1>
          <p className="text-sm text-slate-500">{count.today} להיום · {count.late} באיחור</p>
        </div>
      </section>

      <section className="glass p-4">
        <TaskForm users={users} meId={user.id} today={dayKey(now)} />
      </section>

      <nav className="flex flex-wrap gap-2">
        {(["mine", "all"] as const).map((w) => (
          <Link key={w} href={href({ who: w })} aria-current={w === who ? "page" : undefined} className={pill(w === who)}>
            {w === "mine" ? "שלי" : "כולם"}
          </Link>
        ))}
        <span className="mx-1 w-px bg-slate-200" />
        {(Object.keys(BUCKETS) as Bucket[]).map((b) => (
          <Link key={b} href={href({ tab: b })} aria-current={b === tab ? "page" : undefined} className={pill(b === tab)}>
            {BUCKETS[b]} {b !== "done" && <span className="opacity-75">{count[b]}</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><ListTodo size={26} /></span>
          <h2 className="font-bold">{EMPTY[tab]}</h2>
          <p className="text-sm text-slate-500">משימות נפתחות כאן, מכרטיס המועמד, בקליטה מהירה ואוטומטית על פעימה באיחור</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-slate-500">
              <tr>
                {["", "משימה", "מועמד", "אחראי", tab === "done" ? "בוצע" : "מועד"].map((h, n) => (
                  <th key={n} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-white/70">
                  <td className="w-10 px-4 py-3"><DoneToggle task={t} /></td>
                  <td className={`px-4 py-3 ${t.doneAt ? "text-slate-400 line-through" : "font-medium"}`}>
                    {t.title}
                    {t.installmentId && !t.doneAt && <Link href="/collections?tab=late" className="ms-2 text-xs text-violet-700 hover:underline">לגבייה</Link>}
                  </td>
                  <td className="px-4 py-3">{t.candidate ? <Link href={`/candidates/${t.candidate.id}`} className="hover:underline">{t.candidate.fullName}</Link> : "—"}</td>
                  <td className="px-4 py-3">{t.assignedTo.name ?? t.assignedTo.email}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${!t.doneAt && t.dueAt < now ? "font-bold text-red-600" : ""}`}>
                    {t.doneAt ? t.doneAt.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }) : dueLabel(t.dueAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

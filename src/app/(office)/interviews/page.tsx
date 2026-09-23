import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { addDays, fromIsraelLocal, israelDayKey, israelTime, today } from "@/lib/fees";
import { dayKey } from "@/lib/month";
import { CancelInterviewButton } from "./interview-form";

const dayTitle = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("he-IL", { timeZone: "UTC", ...opts });

// S-12 interviews: week (Sunday first) or day, listed by time. Scheduling is done from the candidate card.
// ponytail: a list per day, not an hourly grid — add a time grid if days get crowded.
export default async function InterviewsPage({ searchParams }: PageProps<"/interviews">) {
  await requireOffice();
  const sp = await searchParams;
  const view = sp.view === "day" ? "day" : "week";
  const now = today();
  const picked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? new Date(sp.date) : now;
  const start = view === "day" ? picked : addDays(picked, -picked.getUTCDay());
  const days = Array.from({ length: view === "day" ? 1 : 7 }, (_, i) => addDays(start, i));
  const end = addDays(start, days.length);

  const interviews = await db.interview.findMany({
    where: { scheduledAt: { gte: fromIsraelLocal(`${dayKey(start)}T00:00`), lt: fromIsraelLocal(`${dayKey(end)}T00:00`) } },
    orderBy: { scheduledAt: "asc" },
    include: {
      candidate: { select: { id: true, fullName: true, phone: true } },
      placement: { select: { job: { select: { title: true, company: { select: { name: true } }, branch: { select: { name: true } } } } } },
    },
  });
  const byDay = Map.groupBy(interviews, (i) => israelDayKey(i.scheduledAt));

  const href = (q: { view?: string; date?: Date }) => `/interviews?${new URLSearchParams({ view: q.view ?? view, date: dayKey(q.date ?? picked) })}`;
  const step = view === "day" ? 1 : 7;
  const range = view === "day" ? dayTitle(start, { weekday: "long", day: "numeric", month: "long" }) : `${dayTitle(start, { day: "numeric", month: "numeric" })} – ${dayTitle(addDays(end, -1), { day: "numeric", month: "numeric", year: "numeric" })}`;
  const pill = (active: boolean) => `rounded-full px-4 py-2 text-sm ${active ? "bg-primary-gradient text-white" : "glass text-slate-600"}`;

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <CalendarDays size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">יומן ראיונות</h1>
          <p className="text-sm text-slate-500">{interviews.length} ראיונות {view === "day" ? "ביום זה" : "בשבוע זה"} · קביעת ראיון מכרטיס המועמד</p>
        </div>
      </section>

      <nav className="flex flex-wrap items-center gap-2">
        <Link href={href({ view: "week" })} aria-current={view === "week" ? "page" : undefined} className={pill(view === "week")}>שבוע</Link>
        <Link href={href({ view: "day" })} aria-current={view === "day" ? "page" : undefined} className={pill(view === "day")}>יום</Link>
        <Link href={href({ date: now })} className="glass rounded-full px-4 py-2 text-sm text-slate-600">היום</Link>
        <div className="glass ms-auto flex items-center gap-1 rounded-full px-2 py-1">
          <Link href={href({ date: addDays(picked, -step) })} aria-label="הקודם" className="rounded-lg p-1.5 hover:bg-white/70"><ChevronRight size={18} /></Link>
          <span className="px-1 text-sm font-bold">{range}</span>
          <Link href={href({ date: addDays(picked, step) })} aria-label="הבא" className="rounded-lg p-1.5 hover:bg-white/70"><ChevronLeft size={18} /></Link>
        </div>
      </nav>

      <section className={`grid gap-2 ${view === "week" ? "md:grid-cols-7" : ""}`}>
        {days.map((d) => {
          const items = byDay.get(dayKey(d)) ?? [];
          const isToday = dayKey(d) === dayKey(now);
          return (
            <div key={dayKey(d)} className={`glass flex flex-col gap-2 p-2 md:min-h-24 ${isToday ? "ring-2 ring-teal-400" : ""}`}>
              <Link href={href({ view: "day", date: d })} className="flex items-baseline justify-between px-1 text-sm hover:text-violet-700 md:flex-col md:items-start">
                <span className="font-bold">{dayTitle(d, { weekday: view === "day" ? "long" : "short" })}</span>
                <span className="text-xs text-slate-500">{dayTitle(d, { day: "numeric", month: "numeric" })}</span>
              </Link>
              {items.map((i) => (
                <div key={i.id} className="rounded-xl bg-white/70 p-2 text-sm">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-violet-700" dir="ltr">{israelTime(i.scheduledAt)}</span>
                    <CancelInterviewButton id={i.id} />
                  </div>
                  <Link href={`/candidates/${i.candidate.id}`} className="block font-medium hover:underline">{i.candidate.fullName}</Link>
                  {view === "day" && <a href={`tel:${i.candidate.phone}`} className="block text-xs text-slate-500" dir="ltr">{i.candidate.phone}</a>}
                  <p className="text-xs text-slate-500">{i.placement ? `${i.placement.job.title} · ${i.placement.job.company.name} · ${i.placement.job.branch.name}` : "ראיון במשרד"}</p>
                  {i.location && <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} className="shrink-0" /> <span className="break-all">{i.location}</span></p>}
                </div>
              ))}
              {items.length === 0 && view === "day" && <p className="py-8 text-center text-sm text-slate-500">אין ראיונות ביום זה</p>}
            </div>
          );
        })}
      </section>
    </>
  );
}

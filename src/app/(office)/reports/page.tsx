import { ChartColumn } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { today } from "@/lib/fees";
import { addMonths, monthKey, parseMonth } from "@/lib/month";
import { daysInStage, funnel } from "@/lib/reports";
import type { Prisma } from "@/generated/prisma/client";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { processSteps } from "../../portal/data";

const select = "rounded-xl border border-slate-200 bg-white p-2.5 text-sm";
const shekel = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;
const monthLabel = (m: Date) => m.toLocaleDateString("he-IL", { month: "short", year: "2-digit", timeZone: "UTC" });
const MAX_MONTHS = 24;

// S-16 reports (decided 23/09/2026): open to every office user. Filters narrow placements —
// company, region of the job's branch, recruiter = candidate owner. The month range applies per chart:
// started work → start date, funnel + time in stage → placement opened, revenue → installment due date.
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireOffice();
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const now = today();
  const thisMonth = parseMonth(undefined, now);
  let from = parseMonth(param("from"), addMonths(thisMonth, -5));
  let to = parseMonth(param("to"), addMonths(thisMonth, 2));
  if (to < from) [from, to] = [to, from];
  if (addMonths(from, MAX_MONTHS) <= to) to = addMonths(from, MAX_MONTHS - 1);
  const end = addMonths(to, 1);
  const months: Date[] = [];
  for (let m = from; m < end; m = addMonths(m, 1)) months.push(m);
  const { company, region, recruiter } = { company: param("company"), region: param("region"), recruiter: param("recruiter") };

  const scope: Prisma.PlacementWhereInput = {
    ...(company || region ? { job: { companyId: company, branch: region ? { city: { parentId: region } } : undefined } } : {}),
    ...(recruiter ? { candidate: { ownerUserId: recruiter } } : {}),
  };
  const range = { gte: from, lt: end };

  const [placements, installments, steps, companies, regions, recruiters] = await Promise.all([
    db.placement.findMany({
      where: { ...scope, OR: [{ startDate: range }, { createdAt: range }] },
      select: {
        startDate: true,
        createdAt: true,
        status: { select: { systemKey: true } },
        activities: { where: { type: "status_change" }, select: { toValue: true, createdAt: true } },
      },
    }),
    db.installment.findMany({ where: { placement: scope, status: { not: "cancelled" }, dueDate: range }, select: { dueDate: true, amount: true, status: true } }),
    processSteps(),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.lookupValue.findMany({ where: { listKey: "region" }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true } }),
    db.user.findMany({ where: { role: { in: ["admin", "recruiter"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  // started work per month — rejected placements don't count (fired ones did start)
  const started = months.map((m) => placements.filter((p) => p.startDate && monthKey(p.startDate) === monthKey(m) && p.status?.systemKey !== "rejected").length);
  const cohort = placements.filter((p) => p.createdAt >= from && p.createdAt < end).map((p) => p.activities);
  const labels = steps.map((s) => s.label);
  const reached = funnel(cohort, labels);
  const stays = daysInStage(cohort, labels);

  const revenue = months.map((m) => {
    const rows = installments.filter((i) => monthKey(i.dueDate) === monthKey(m));
    const sum = (f: (i: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, i) => s + Number(i.amount), 0);
    const paid = sum((i) => i.status === "paid");
    const late = sum((i) => i.status === "expected" && i.dueDate < now);
    const expected = sum((i) => i.status === "expected" && i.dueDate >= now);
    return { month: m, paid, late, expected, total: paid + late + expected };
  });
  const revenueTotal = revenue.reduce((s, r) => ({ paid: s.paid + r.paid, late: s.late + r.late, expected: s.expected + r.expected }), { paid: 0, late: 0, expected: 0 });

  const maxStarted = Math.max(1, ...started);
  const maxRevenue = Math.max(1, ...revenue.map((r) => r.total));
  const maxStay = Math.max(1, ...stays.map((s) => s.avg ?? 0));

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <ChartColumn size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">דוחות וחתכים</h1>
          <p className="text-sm text-slate-500">
            {monthLabel(from)} – {monthLabel(to)} · סכומים לפני מע״מ
          </p>
        </div>
      </section>

      <AutoFilterForm action="/reports" className="glass flex flex-wrap items-center gap-2 p-3">
        <label className="flex items-center gap-1 text-sm text-slate-500">
          מחודש <input type="month" name="from" defaultValue={monthKey(from)} className={select} />
        </label>
        <label className="flex items-center gap-1 text-sm text-slate-500">
          עד <input type="month" name="to" defaultValue={monthKey(to)} className={select} />
        </label>
        <select name="company" defaultValue={company ?? ""} className={select} aria-label="חברה">
          <option value="">כל החברות</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="region" defaultValue={region ?? ""} className={select} aria-label="אזור המשרה">
          <option value="">כל האזורים</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select name="recruiter" defaultValue={recruiter ?? ""} className={select} aria-label="רכז">
          <option value="">כל הרכזים</option>
          {recruiters.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
        </select>
        <ClearFiltersButton />
      </AutoFilterForm>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass space-y-3 p-5">
          <h2 className="font-bold">התחילו לעבוד לפי חודש</h2>
          <p className="text-xs text-slate-500">השמות לפי תאריך התחלה · {started.reduce((a, b) => a + b, 0)} בסך הכל</p>
          <div className="flex gap-1 overflow-x-auto">
            {months.map((m, i) => (
              <div key={monthKey(m)} className="min-w-10 flex-1" title={`${monthLabel(m)}: ${started[i]}`}>
                <div className="flex h-40 flex-col items-center justify-end gap-1 border-b border-slate-200">
                  {started[i] > 0 && <span className="text-xs font-bold text-slate-700">{started[i]}</span>}
                  <div className="bg-primary-gradient w-full max-w-10 rounded-t" style={{ height: `${(started[i] / maxStarted) * 85}%` }} />
                </div>
                <span className="block pt-1 text-center text-[11px] whitespace-nowrap text-slate-500">{monthLabel(m)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass space-y-3 p-5">
          <h2 className="font-bold">המרה בין שלבים</h2>
          <p className="text-xs text-slate-500">{cohort.length} השמות שנפתחו בטווח · כמה הגיעו לכל שלב (גם מי שנדחה אחר כך)</p>
          {cohort.length ? (
            <ul className="space-y-2">
              {steps.map((s, i) => (
                <li key={s.id} className="space-y-1" title={`${s.label}: ${reached[i]}`}>
                  <div className="flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="text-slate-600">
                      <b className="text-slate-800">{reached[i]}</b>
                      {i > 0 && reached[i - 1] > 0 && <span className="text-xs"> · {Math.round((reached[i] / reached[i - 1]) * 100)}% מהשלב הקודם</span>}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="bg-primary-gradient h-3 rounded-full" style={{ width: `${(reached[i] / cohort.length) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">לא נפתחו השמות בטווח הזה</p>
          )}
        </section>

        <section className="glass space-y-3 p-5">
          <h2 className="font-bold">זמן ממוצע בשלב</h2>
          <p className="text-xs text-slate-500">בימים, לפי מעברי סטטוס של ההשמות שנפתחו בטווח · השלב הנוכחי לא נספר עד שעוברים ממנו</p>
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{s.label}</span>
                  <span className="text-slate-600">{stays[i].avg === null ? "—" : <><b className="text-slate-800">{stays[i].avg}</b> ימים <span className="text-xs">({stays[i].n})</span></>}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="bg-accent-gradient h-3 rounded-full" style={{ width: `${((stays[i].avg ?? 0) / maxStay) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass space-y-3 p-5">
          <h2 className="font-bold">הכנסות לפי חודש</h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-emerald-500" /> שולם</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-red-500" /> באיחור</span>
            <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-violet-400" /> צפוי</span>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {revenue.map((r) => (
              <div key={monthKey(r.month)} className="min-w-10 flex-1" title={`${monthLabel(r.month)} — שולם ${shekel(r.paid)} · באיחור ${shekel(r.late)} · צפוי ${shekel(r.expected)}`}>
                <div className="flex h-40 flex-col items-center justify-end gap-0.5 border-b border-slate-200">
                  {([["bg-violet-400", r.expected], ["bg-red-500", r.late], ["bg-emerald-500", r.paid]] as const).map(([tone, v]) =>
                    v > 0 ? <div key={tone} className={`${tone} w-full max-w-10 first:rounded-t`} style={{ height: `${(v / maxRevenue) * 100}%` }} /> : null,
                  )}
                </div>
                <span className="block pt-1 text-center text-[11px] whitespace-nowrap text-slate-500">{monthLabel(r.month)}</span>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="text-start">
                  <th className="p-1.5 text-start font-medium">חודש</th>
                  <th className="p-1.5 text-start font-medium">שולם</th>
                  <th className="p-1.5 text-start font-medium">באיחור</th>
                  <th className="p-1.5 text-start font-medium">צפוי</th>
                </tr>
              </thead>
              <tbody>
                {revenue.filter((r) => r.total > 0).map((r) => (
                  <tr key={monthKey(r.month)} className="border-t border-slate-100">
                    <td className="p-1.5">{monthLabel(r.month)}</td>
                    <td className="p-1.5">{r.paid ? shekel(r.paid) : "—"}</td>
                    <td className={`p-1.5 ${r.late ? "font-medium text-red-600" : ""}`}>{r.late ? shekel(r.late) : "—"}</td>
                    <td className="p-1.5">{r.expected ? shekel(r.expected) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-bold">
                  <td className="p-1.5">סה״כ</td>
                  <td className="p-1.5">{shekel(revenueTotal.paid)}</td>
                  <td className="p-1.5 text-red-600">{shekel(revenueTotal.late)}</td>
                  <td className="p-1.5">{shekel(revenueTotal.expected)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { today } from "@/lib/fees";
import { addMonths, dayKey, monthGrid, monthKey, parseMonth } from "@/lib/month";
import type { Prisma } from "@/generated/prisma/client";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { PlacementDrawer } from "../placements/drawer";
import { PaidForm, UnpaidButton } from "./paid-form";

const day = (d: Date) => d.toLocaleDateString("he-IL", { timeZone: "UTC" });
const shekel = (n: number) => `${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ₪`;
const sum = (rows: { amount: unknown }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);
const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const TABS = { expected: "צפוי", late: "באיחור", paid: "שולם" } as const;
type Tab = keyof typeof TABS;

const include = {
  placement: {
    select: {
      id: true,
      candidate: { select: { fullName: true } },
      job: { select: { title: true, company: { select: { name: true } }, branch: { select: { name: true } } } },
    },
  },
} satisfies Prisma.InstallmentInclude;

// S-14 collections: installments due in a month on a calendar, and a list by status.
// "Late" is derived (expected + due date passed) and covers every month, not just the one shown.
export default async function CollectionsPage({ searchParams }: PageProps<"/collections">) {
  await requireOffice();
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const now = today();
  const month = parseMonth(param("month"), now);
  const company = param("company");
  const tab = (Object.hasOwn(TABS, param("tab") ?? "") ? param("tab") : "expected") as Tab;
  const openId = param("p");

  const byCompany: Prisma.InstallmentWhereInput = company ? { placement: { job: { companyId: company } } } : {};
  const [monthRows, lateRows, companies] = await Promise.all([
    db.installment.findMany({
      where: { ...byCompany, status: { not: "cancelled" }, dueDate: { gte: month, lt: addMonths(month, 1) } },
      include,
      orderBy: [{ dueDate: "asc" }, { seq: "asc" }],
    }),
    db.installment.findMany({ where: { ...byCompany, status: "expected", dueDate: { lt: now } }, include, orderBy: [{ dueDate: "asc" }, { seq: "asc" }] }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const isLate = (i: { status: string; dueDate: Date }) => i.status === "expected" && i.dueDate < now;
  const lists: Record<Tab, typeof monthRows> = {
    expected: monthRows.filter((i) => i.status === "expected" && !isLate(i)),
    late: lateRows,
    paid: monthRows.filter((i) => i.status === "paid"),
  };
  const rows = lists[tab];

  const perDay = new Map<string, typeof monthRows>();
  for (const i of monthRows) perDay.set(dayKey(i.dueDate), [...(perDay.get(dayKey(i.dueDate)) ?? []), i]);

  const href = (q: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ month: monthKey(month), company, tab, ...q }).filter((e): e is [string, string] => !!e[1]));
    return `/collections?${s}`;
  };
  const monthLabel = month.toLocaleDateString("he-IL", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <Wallet size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">גבייה</h1>
          <p className="text-sm text-slate-500">תקבולים צפויים לפי חודש · סכומים לפני מע״מ</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: `לגבייה ב${monthLabel}`, value: sum(monthRows), cls: "text-violet-700" },
          { label: "שולם מתוכם", value: sum(lists.paid), cls: "text-emerald-700" },
          { label: `באיחור (${lateRows.length})`, value: sum(lateRows), cls: "text-red-600" },
        ].map((k) => (
          <div key={k.label} className="glass p-4">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`text-2xl font-bold ${k.cls}`}>{shekel(k.value)}</p>
          </div>
        ))}
      </section>

      <AutoFilterForm action="/collections" className="glass flex flex-wrap gap-2 p-3">
        <input type="hidden" name="month" value={monthKey(month)} />
        <input type="hidden" name="tab" value={tab} />
        <select name="company" defaultValue={company ?? ""} className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm" aria-label="חברה">
          <option value="">כל החברות</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {company && <ClearFiltersButton />}
      </AutoFilterForm>

      <section className="glass space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Link href={href({ month: monthKey(addMonths(month, -1)), p: undefined })} aria-label="חודש קודם" className="rounded-lg p-1.5 hover:bg-white/70"><ChevronRight size={20} /></Link>
          <h2 className="font-bold">{monthLabel}</h2>
          <Link href={href({ month: monthKey(addMonths(month, 1)), p: undefined })} aria-label="חודש הבא" className="rounded-lg p-1.5 hover:bg-white/70"><ChevronLeft size={20} /></Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAYS.map((w) => <div key={w} className="py-1 text-slate-500">{w}</div>)}
          {monthGrid(month).flat().map((d, n) => {
            if (!d) return <div key={n} />;
            const items = perDay.get(dayKey(d)) ?? [];
            const tone = items.some(isLate) ? "bg-red-50 text-red-700" : items.length && items.every((i) => i.status === "paid") ? "bg-emerald-50 text-emerald-700" : items.length ? "bg-violet-50 text-violet-700" : "bg-white/40 text-slate-400";
            return (
              <div key={n} className={`min-h-14 rounded-lg p-1 ${tone} ${dayKey(d) === dayKey(now) ? "ring-2 ring-teal-400" : ""}`} title={items.map((i) => `${i.placement.job.company.name}: ${shekel(Number(i.amount))}`).join("\n")}>
                <div>{d.getUTCDate()}</div>
                {items.length > 0 && <div className="truncate text-[10px] font-bold sm:text-xs">{Math.round(sum(items)).toLocaleString("he-IL")}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <nav className="flex gap-2">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link key={t} href={href({ tab: t, p: undefined })} aria-current={t === tab ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm ${t === tab ? "bg-primary-gradient text-white" : "glass text-slate-600"}`}>
            {TABS[t]} <span className="opacity-75">{lists[t].length}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Wallet size={26} /></span>
          <h2 className="font-bold">{{ expected: "אין פעימות צפויות בחודש זה", late: "אין פעימות באיחור", paid: "לא סומנו תשלומים בחודש זה" }[tab]}</h2>
          <p className="text-sm text-slate-500">פעימות נוצרות כשמזינים תאריך התחלה בהשמה</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-slate-500">
              <tr>
                {["מועד", "חברה · סניף", "מועמד · משרה", "פעימה", "סכום", tab === "paid" ? "שולם ב" : ""].map((h, n) => (
                  <th key={n} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-white/70">
                  <td className={`px-4 py-3 whitespace-nowrap ${isLate(i) ? "font-bold text-red-600" : ""}`}>{day(i.dueDate)}</td>
                  <td className="px-4 py-3">{i.placement.job.company.name} · {i.placement.job.branch.name}</td>
                  <td className="px-4 py-3">
                    <Link href={href({ p: i.placement.id })} scroll={false} className="font-bold hover:underline">{i.placement.candidate.fullName}</Link>
                    <span className="block text-xs text-slate-500">{i.placement.job.title}</span>
                  </td>
                  <td className="px-4 py-3">{i.seq}</td>
                  <td className="px-4 py-3 font-bold whitespace-nowrap">{shekel(Number(i.amount))}</td>
                  <td className="px-4 py-3">
                    {i.status === "paid" ? (
                      <div className="flex items-center justify-between gap-2">
                        <span>{day(i.paidAt!)}</span>
                        <UnpaidButton installmentId={i.id} />
                      </div>
                    ) : (
                      <PaidForm installmentId={i.id} today={dayKey(now)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <PlacementDrawer placementId={openId} closeHref={href({ p: undefined })} />}
    </>
  );
}

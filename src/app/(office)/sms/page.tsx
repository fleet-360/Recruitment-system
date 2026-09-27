import { MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getList } from "@/lib/lookups";
import { israelDateTime } from "@/lib/fees";
import { smsConfigured, withOptOut } from "@/lib/sms";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { resolveSegment, segmentKeys, type Segment } from "./segment";
import { SmsForm } from "./sms-form";

const select = "rounded-xl border border-slate-200 bg-white p-2.5 text-sm";

// S-15 bulk SMS: segment → recipients (+ how many were left out for no consent) → message → confirm. Admin only.
export default async function SmsPage({ searchParams }: PageProps<"/sms">) {
  await requireAdmin();
  const sp = await searchParams;
  const segment: Segment = Object.fromEntries(segmentKeys.map((k) => [k, typeof sp[k] === "string" && sp[k] ? sp[k] : undefined]));

  const [{ where }, regions, cities, languages, statuses, campaigns] = await Promise.all([
    resolveSegment(segment),
    getList("region"),
    getList("city"),
    getList("language"),
    getList("candidate_status"),
    db.smsCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { sentBy: { select: { name: true, email: true } } } }),
  ]);
  const [recipients, noConsent] = await Promise.all([
    db.candidate.findMany({ where: { AND: [where, { marketingConsent: true }] }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    db.candidate.count({ where: { AND: [where, { marketingConsent: false }] } }),
  ]);
  const filters: [keyof Segment, string, { id: string; label: string }[]][] = [
    ["region", "כל האזורים", regions],
    ["city", "כל הערים", cities],
    ["language", "כל השפות", languages],
    ["status", "כל הסטטוסים", statuses],
  ];

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <MessageSquare size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">תפוצת SMS</h1>
          <p className="text-sm text-slate-500">{smsConfigured() ? "נשלח דרך InforU" : "מצב בדיקה — InforU עוד לא מוגדר, ההודעות לא יישלחו בפועל"}</p>
        </div>
      </section>

      <AutoFilterForm action="/sms" className="glass flex flex-wrap gap-2 p-3">
        {filters.map(([name, all, options]) => (
          <select key={name} name={name} defaultValue={segment[name] ?? ""} className={select} aria-label={all}>
            <option value="">{all}</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ))}
        {Object.values(segment).some(Boolean) && <ClearFiltersButton />}
      </AutoFilterForm>

      <section className="glass p-4 text-sm">
        <p>
          <span className="text-lg font-bold">{recipients.length}</span> נמענים
          {noConsent > 0 && <span className="text-slate-500"> · {noConsent} סוננו כי אין הסכמה לדיוור</span>}
        </p>
        {recipients.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-slate-500">הצגת הנמענים</summary>
            <p className="mt-2 max-h-40 overflow-y-auto leading-7">{recipients.map((r) => r.fullName).join(" · ")}</p>
          </details>
        )}
      </section>

      <SmsForm segment={segment} recipients={recipients.length} footer={withOptOut("", "xxxxxxxx")} />

      <section className="glass overflow-x-auto p-4">
        <h2 className="mb-3 font-bold">שליחות אחרונות</h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-400">עדיין לא נשלחה תפוצה</p>
        ) : (
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-slate-200/70 text-start text-xs text-slate-500">
              <tr>
                {["מתי", "פילוח", "הודעה", "נשלחו", "שולח"].map((h) => <th key={h} className="p-2 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="p-2 whitespace-nowrap">{israelDateTime(c.createdAt)}</td>
                  <td className="p-2">{c.segment}</td>
                  <td className="p-2 whitespace-pre-wrap">{c.message}</td>
                  <td className="p-2 whitespace-nowrap">
                    {c.sentCount}
                    {c.failedCount > 0 && <span className="text-red-600"> · {c.failedCount} נכשלו</span>}
                    {c.dryRun && <span className="text-slate-400"> (בדיקה)</span>}
                  </td>
                  <td className="p-2">{c.sentBy.name ?? c.sentBy.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

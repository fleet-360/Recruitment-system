import Link from "next/link";
import { Inbox, MessageSquare, Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { candidateWhere } from "@/lib/access";
import { getList } from "@/lib/lookups";
import type { Prisma } from "@/generated/prisma/client";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { QuickAdd } from "./quick-add";

const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);
const select = "rounded-xl border border-slate-200 bg-white p-2.5 text-sm";

// S-04 candidate list
export default async function CandidatesPage({ searchParams }: PageProps<"/candidates">) {
  const user = await requireOffice();
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const [q, status, city, language, source] = ["q", "status", "city", "language", "source"].map(param);

  const [statuses, cities, languages, sources, newLeads] = await Promise.all([
    getList("candidate_status"),
    getList("city"),
    getList("language"),
    getList("lead_source"),
    db.lead.count({ where: { candidateId: null, dismissedAt: null } }),
  ]);

  const digits = q?.replace(/\D/g, "");
  const search: Prisma.CandidateWhereInput[] = q
    ? [{ fullName: { contains: q, mode: "insensitive" } }, ...(digits ? [{ phone: { contains: digits } }] : [])]
    : [];

  // Everything except the status filter — the pill counts are computed on this.
  const base: Prisma.CandidateWhereInput = {
    AND: [
      await candidateWhere(user),
      search.length ? { OR: search } : {},
      city ? { cityId: city } : {},
      source ? { sourceId: source } : {},
      language ? { languages: { some: { languageId: language } } } : {},
    ],
  };

  const [counts, candidates] = await Promise.all([
    db.candidate.groupBy({ by: ["statusId"], where: base, _count: true }),
    db.candidate.findMany({
      where: { AND: [base, status ? { statusId: status } : {}] },
      orderBy: { createdAt: "desc" },
      take: 100, // ponytail: no pagination yet, add when the list passes a few hundred
      include: {
        city: { select: { label: true } },
        status: { select: { label: true } },
        source: { select: { label: true } },
        languages: { select: { language: { select: { label: true } } } },
        activities: { where: { type: "status_change" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
  ]);
  const countOf = (id: string) => counts.find((c) => c.statusId === id)?._count ?? 0;
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries({ q, status, city, language, source, ...patch }).filter((e): e is [string, string] => !!e[1]));
    return `/candidates${next.size ? `?${next}` : ""}`;
  };
  const filtered = !!(q || status || city || language || source);

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <Users size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">מועמדים</h1>
          <p className="text-sm text-slate-500">{total} מועמדים</p>
        </div>
        <Link href="/leads" className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-violet-700 hover:bg-white/80">
          <Inbox size={16} /> לידים
          {newLeads > 0 && <span className="bg-accent-gradient rounded-full px-2 text-xs text-white">{newLeads}</span>}
        </Link>
        {user.role === "admin" && (
          <Link href="/sms" className="glass flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-violet-700 hover:bg-white/80">
            <MessageSquare size={16} /> תפוצת SMS
          </Link>
        )}
        <QuickAdd sources={sources} defaultOpen={sp.new === "1"} />
      </section>

      <AutoFilterForm action="/candidates" className="glass flex flex-wrap gap-2 p-3">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="relative flex-1 basis-48">
          <Search size={16} className="absolute start-3 top-3 text-slate-400" />
          <input name="q" defaultValue={q} type="search" placeholder="חיפוש לפי שם או טלפון" className={`${select} w-full ps-9`} />
        </label>
        <select name="city" defaultValue={city ?? ""} className={select} aria-label="עיר">
          <option value="">כל הערים</option>
          {cities.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select name="language" defaultValue={language ?? ""} className={select} aria-label="שפה">
          <option value="">כל השפות</option>
          {languages.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select name="source" defaultValue={source ?? ""} className={select} aria-label="מקור">
          <option value="">כל המקורות</option>
          {sources.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {filtered && <ClearFiltersButton />}
      </AutoFilterForm>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {[{ id: undefined, label: "הכל", n: total }, ...statuses.map((s) => ({ id: s.id, label: s.label, n: countOf(s.id) }))].map((p) => (
          <Link
            key={p.label}
            href={href({ status: p.id })}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              status === p.id ? "bg-accent-gradient text-white" : "glass text-slate-600"
            }`}
          >
            {p.label}
            <span className={`rounded-full px-2 text-xs ${status === p.id ? "bg-white/25" : "bg-slate-100"}`}>{p.n}</span>
          </Link>
        ))}
      </nav>

      {candidates.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Users size={26} />
          </span>
          <h2 className="font-bold">אין מועמדים</h2>
          <p className="text-sm text-slate-500">{filtered ? "נסה לשנות את הסינון" : "התחל בקליטה מהירה של מועמד ראשון"}</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-slate-200/70 text-start text-xs text-slate-500">
              <tr>
                {["שם", "טלפון", "סטטוס", "זמן בשלב", "עיר", "שפות", "מקור", "נקלט"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                // The name link stretches over the whole row (after:inset-0), so any click opens the card.
                <tr key={c.id} className="relative border-b border-slate-100 last:border-0 hover:bg-white/70">
                  <td className="px-4 py-3">
                    <Link href={`/candidates/${c.id}`} className="flex items-center gap-2 font-bold after:absolute after:inset-0">
                      <span className="bg-primary-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-xs text-white">
                        {c.fullName[0]}
                      </span>
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-end whitespace-nowrap" dir="ltr">{c.anonymizedAt ? "—" : c.phone}</td>
                  <td className="px-4 py-3">
                    {c.status && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs whitespace-nowrap text-violet-700">{c.status.label}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{daysSince(c.activities[0]?.createdAt ?? c.createdAt)}ד׳</td>
                  <td className="px-4 py-3">{c.city?.label ?? "—"}</td>
                  <td className="px-4 py-3">{c.languages.map((l) => l.language.label).join(", ") || "—"}</td>
                  <td className="px-4 py-3">{c.source?.label ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.createdAt.toLocaleDateString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

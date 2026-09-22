import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { JobForm } from "./job-form";
import { branchGroups } from "./branch-groups";

const select = "rounded-xl border border-slate-200 bg-white p-2.5 text-sm";

// S-09 jobs
export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  await requireOffice();
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const [company, branch, status] = ["company", "branch", "status"].map(param);

  const where: Prisma.JobWhereInput = {
    ...(company && { companyId: company }),
    ...(branch && { branchId: branch }),
    ...(status === "open" || status === "closed" ? { status } : {}),
  };

  const [jobs, groups, companies] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200, // ponytail: no pagination yet, add when open + closed jobs pass a few hundred
      include: {
        company: { select: { name: true } },
        branch: { select: { name: true, city: { select: { label: true } } } },
        _count: { select: { placements: true } },
      },
    }),
    branchGroups(),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const filtered = !!(company || branch || status);
  const branchFilter = company ? groups.find((g) => g.companyId === company)?.branches ?? [] : groups.flatMap((g) => g.branches);

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <Briefcase size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">משרות</h1>
          <p className="text-sm text-slate-500">{jobs.length} משרות</p>
        </div>
      </section>

      <details className="glass p-5" open={sp.new === "1"}>
        <summary className="flex items-center gap-1 font-bold text-violet-700"><Plus size={18} /> פתיחת משרה</summary>
        <div className="pt-4">
          {groups.length ? (
            <JobForm job={null} groups={groups} />
          ) : (
            <p className="text-sm text-slate-500">
              אין עדיין חברות — <Link href="/companies" className="font-bold text-violet-700 underline">הוסף חברה</Link> כדי לפתוח משרה.
            </p>
          )}
        </div>
      </details>

      <AutoFilterForm action="/jobs" className="glass flex flex-wrap gap-2 p-3">
        <select name="company" defaultValue={company ?? ""} className={select} aria-label="חברה">
          <option value="">כל החברות</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="branch" defaultValue={branch ?? ""} className={select} aria-label="סניף">
          <option value="">כל הסניפים</option>
          {branchFilter.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} className={select} aria-label="סטטוס">
          <option value="">כל הסטטוסים</option>
          <option value="open">פתוחות</option>
          <option value="closed">סגורות</option>
        </select>
        {filtered && <ClearFiltersButton />}
      </AutoFilterForm>

      {jobs.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Briefcase size={26} />
          </span>
          <h2 className="font-bold">אין משרות</h2>
          <p className="text-sm text-slate-500">{filtered ? "נסה לשנות את הסינון" : "פתח את המשרה הראשונה"}</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-slate-500">
              <tr>
                {["משרה", "חברה", "סניף", "שכר", "תקנים", "מועמדים", "סטטוס", "נפתחה"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="relative border-b border-slate-100 last:border-0 hover:bg-white/70">
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${j.id}`} className="font-bold after:absolute after:inset-0">{j.title}</Link>
                  </td>
                  <td className="px-4 py-3">{j.company.name}</td>
                  <td className="px-4 py-3">{[j.branch.name, j.branch.city?.label].filter(Boolean).join(" · ")}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{j.salary ? `${Number(j.salary).toLocaleString("he-IL")} ₪` : "—"}</td>
                  <td className="px-4 py-3">{j.openings}</td>
                  <td className="px-4 py-3">{j._count.placements}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${j.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {j.status === "open" ? "פתוחה" : "סגורה"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{j.createdAt.toLocaleDateString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

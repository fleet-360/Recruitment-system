import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { getList } from "@/lib/lookups";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { NewCompany } from "./new-company";

// S-07 companies
export default async function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  await requireOffice();
  const sp = await searchParams;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;

  const [companies, cities] = await Promise.all([
    db.company.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      orderBy: { name: "asc" },
      include: {
        branches: { select: { city: { select: { label: true } } } },
        _count: { select: { jobs: { where: { status: "open" } } } },
      },
    }),
    getList("city"),
  ]);

  // Active = not rejected and not ended. ponytail: counted in JS, move to a groupBy/SQL count past a few thousand placements.
  const active = await db.placement.findMany({
    where: { endDate: null, rejectionReasonId: null, job: { companyId: { in: companies.map((c) => c.id) } } },
    select: { job: { select: { companyId: true } } },
  });
  const activeOf = (id: string) => active.filter((p) => p.job.companyId === id).length;

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <Building2 size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">חברות</h1>
          <p className="text-sm text-slate-500">{companies.length} חברות</p>
        </div>
        <NewCompany cities={cities} />
      </section>

      <AutoFilterForm action="/companies" className="glass flex flex-wrap gap-2 p-3">
        <label className="relative flex-1 basis-48">
          <Search size={16} className="absolute start-3 top-3 text-slate-400" />
          <input name="q" defaultValue={q} type="search" placeholder="חיפוש לפי שם חברה" className="w-full rounded-xl border border-slate-200 bg-white p-2.5 ps-9 text-sm" />
        </label>
        {q && <ClearFiltersButton />}
      </AutoFilterForm>

      {companies.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Building2 size={26} />
          </span>
          <h2 className="font-bold">אין חברות</h2>
          <p className="text-sm text-slate-500">{q ? "נסה חיפוש אחר" : "הוסף את החברה הראשונה"}</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-slate-500">
              <tr>
                {["חברה", "ערים", "סניפים", "משרות פתוחות", "השמות פעילות"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="relative border-b border-slate-100 last:border-0 hover:bg-white/70">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${c.id}`} className="flex items-center gap-2 font-bold after:absolute after:inset-0">
                      <span className="bg-primary-gradient flex size-8 shrink-0 items-center justify-center rounded-lg text-xs text-white">{c.name[0]}</span>
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{[...new Set(c.branches.map((b) => b.city?.label).filter(Boolean))].join(", ") || "—"}</td>
                  <td className="px-4 py-3">{c.branches.length}</td>
                  <td className="px-4 py-3">{c._count.jobs}</td>
                  <td className="px-4 py-3">{activeOf(c.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

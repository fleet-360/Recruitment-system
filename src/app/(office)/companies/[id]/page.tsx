import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building2, Mail, MapPin, Phone, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { getList, withCurrent } from "@/lib/lookups";
import { JobForm } from "../../jobs/job-form";
import { BranchForm, CompanyForm, ContactForm, DeleteContactButton } from "./forms";

const termsSummary = (b: { feeType: string | null; feeValue: unknown; paymentTerms: unknown[] }) =>
  !b.feeType
    ? "אין תנאי תשלום"
    : `${b.feeType === "fixed" ? `${Number(b.feeValue).toLocaleString("he-IL")} ₪` : `${Number(b.feeValue)}% משכר`} · ${b.paymentTerms.length} פעימות`;

// S-08 company card. ponytail: business users tab comes with S-18 (task 12).
export default async function CompanyPage({ params }: PageProps<"/companies/[id]">) {
  await requireOffice();
  const { id } = await params;

  const company = await db.company.findUnique({
    where: { id },
    include: {
      branches: {
        orderBy: { name: "asc" },
        include: { city: { select: { id: true, label: true } }, paymentTerms: { orderBy: { seq: "asc" } } },
      },
      contacts: { orderBy: { name: "asc" }, include: { branch: { select: { name: true } } } },
      jobs: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { branch: { select: { name: true } }, _count: { select: { placements: true } } },
      },
    },
  });
  if (!company) notFound();

  const cities = await getList("city").then((l) => withCurrent(l, ...company.branches.map((b) => b.city)));
  const branchOptions = company.branches.map((b) => ({ id: b.id, label: b.name }));
  const openJobs = company.jobs.filter((j) => j.status === "open").length;

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-primary-gradient flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white">{company.name[0]}</span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-sm text-slate-500">
            {company.branches.length} סניפים · {openJobs} משרות פתוחות · {company.contacts.length} אנשי קשר
          </p>
        </div>
        <Link href="/companies" className="text-sm text-slate-500 hover:underline">כל החברות</Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass p-5">
          <h2 className="mb-4 font-bold">פרטים</h2>
          <CompanyForm company={{ id, name: company.name, regNumber: company.regNumber, notes: company.notes }} />
        </section>

        <section className="glass space-y-3 p-5">
          <h2 className="font-bold">אנשי קשר</h2>
          <ul className="space-y-2">
            {company.contacts.map((c) => (
              <li key={c.id} className="rounded-xl bg-white/60">
                <details>
                  <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                    <span className="font-bold">{c.name}</span>
                    {c.role && <span className="text-slate-500">{c.role}</span>}
                    <span className="rounded-full bg-slate-100 px-2 text-xs">{c.branch?.name ?? "כל החברה"}</span>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-violet-700" dir="ltr">
                        <Phone size={14} /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-violet-700" dir="ltr">
                        <Mail size={14} /> {c.email}
                      </a>
                    )}
                  </summary>
                  <div className="flex items-start gap-2 p-3 pt-0">
                    <div className="flex-1">
                      <ContactForm companyId={id} contact={{ id: c.id, name: c.name, role: c.role, phone: c.phone, email: c.email, branchId: c.branchId }} branches={branchOptions} />
                    </div>
                    <DeleteContactButton id={c.id} name={c.name} />
                  </div>
                </details>
              </li>
            ))}
            {company.contacts.length === 0 && <li className="text-sm text-slate-400">אין עדיין אנשי קשר</li>}
          </ul>
          <details className="rounded-xl border border-dashed border-slate-300 p-3">
            <summary className="flex items-center gap-1 text-sm text-violet-700"><Plus size={16} /> איש קשר חדש</summary>
            <div className="pt-3"><ContactForm companyId={id} contact={null} branches={branchOptions} /></div>
          </details>
        </section>
      </div>

      <section className="glass space-y-3 p-5">
        <h2 className="font-bold">סניפים ותנאי תשלום</h2>
        {company.branches.map((b) => (
          <details key={b.id} className="rounded-xl bg-white/60">
            <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
              <Building2 size={16} className="text-violet-500" />
              <span className="font-bold">{b.name}</span>
              {b.city && <span className="flex items-center gap-1 text-slate-500"><MapPin size={14} /> {b.city.label}</span>}
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${b.feeType ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{termsSummary(b)}</span>
            </summary>
            <div className="p-3 pt-0">
              <BranchForm
                companyId={id}
                cities={cities}
                branch={{
                  id: b.id,
                  name: b.name,
                  cityId: b.cityId,
                  address: b.address,
                  feeType: b.feeType,
                  feeValue: b.feeValue === null ? null : Number(b.feeValue),
                  terms: b.paymentTerms.map((t) => ({ sharePercent: Number(t.sharePercent), daysAfterStart: t.daysAfterStart })),
                }}
              />
            </div>
          </details>
        ))}
        <details className="rounded-xl border border-dashed border-slate-300 p-3">
          <summary className="flex items-center gap-1 text-sm text-violet-700"><Plus size={16} /> סניף חדש</summary>
          <div className="pt-3"><BranchForm companyId={id} cities={cities} branch={null} /></div>
        </details>
      </section>

      <section className="glass space-y-3 p-5">
        <h2 className="font-bold">משרות</h2>
        {company.jobs.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl bg-white/60 text-sm">
            {company.jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="flex flex-wrap items-center gap-3 p-3 hover:bg-white/70">
                  <Briefcase size={16} className="text-violet-500" />
                  <span className="font-bold">{j.title}</span>
                  <span className="text-slate-500">{j.branch.name}</span>
                  <span className="text-slate-500">{j._count.placements} מועמדים</span>
                  <span className={`ms-auto rounded-full px-2.5 py-0.5 text-xs ${j.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {j.status === "open" ? "פתוחה" : "סגורה"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-xl border border-dashed border-slate-300 p-3" open={company.jobs.length === 0}>
          <summary className="flex items-center gap-1 text-sm text-violet-700"><Plus size={16} /> פתיחת משרה</summary>
          <div className="pt-3">
            <JobForm job={null} groups={[{ companyId: id, company: company.name, branches: branchOptions }]} defaultBranchId={branchOptions.length === 1 ? branchOptions[0].id : undefined} />
          </div>
        </details>
      </section>
    </>
  );
}

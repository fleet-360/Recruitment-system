import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Lock, LockOpen, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { getList } from "@/lib/lookups";
import { JobForm } from "../job-form";
import { branchGroups } from "../branch-groups";
import { toggleJobStatus } from "../actions";

// S-10 job: details + placements board by process status.
// ponytail: "שייך מועמד" and moving cards come with placements (task 16).
export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  await requireOffice();
  const { id } = await params;

  const job = await db.job.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      branch: { select: { name: true, city: { select: { label: true } } } },
      createdBy: { select: { name: true, email: true } },
      placements: { orderBy: { createdAt: "asc" }, include: { candidate: { select: { id: true, fullName: true } } } },
    },
  });
  if (!job) notFound();

  const [statuses, groups] = await Promise.all([getList("placement_status"), branchGroups()]);
  // A placement may sit in a status that was deactivated since — give it its own column rather than hiding it.
  const columns = [...statuses, ...(job.placements.some((p) => !p.statusId || !statuses.some((s) => s.id === p.statusId)) ? [{ id: "other", label: "אחר" }] : [])];
  const inColumn = (colId: string) =>
    job.placements.filter((p) => (colId === "other" ? !p.statusId || !statuses.some((s) => s.id === p.statusId) : p.statusId === colId));
  const open = job.status === "open";

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <Briefcase size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/companies/${job.company.id}`} className="text-violet-700 hover:underline">{job.company.name}</Link>
            {" · "}
            {[job.branch.name, job.branch.city?.label].filter(Boolean).join(", ")} · {job.openings} תקנים · נפתחה {job.createdAt.toLocaleDateString("he-IL")} ע״י{" "}
            {job.createdBy.name ?? job.createdBy.email}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{open ? "פתוחה" : "סגורה"}</span>
        <form action={toggleJobStatus.bind(null, id)}>
          <button className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50">
            {open ? <><Lock size={16} /> סגירת משרה</> : <><LockOpen size={16} /> פתיחה מחדש</>}
          </button>
        </form>
      </section>

      <section className="glass space-y-3 p-5">
        <h2 className="font-bold">מועמדים במשרה</h2>
        {job.placements.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users size={22} />
            </span>
            <p className="text-sm text-slate-500">אין עדיין מועמדים במשרה הזו</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {columns.map((col) => (
              <div key={col.id} className="w-52 shrink-0 space-y-2 rounded-xl bg-white/50 p-2">
                <h3 className="flex items-center justify-between px-1 text-sm font-medium">
                  {col.label}
                  <span className="rounded-full bg-slate-100 px-2 text-xs">{inColumn(col.id).length}</span>
                </h3>
                {inColumn(col.id).map((p) => (
                  <Link key={p.id} href={`/candidates/${p.candidate.id}`} className="flex items-center gap-2 rounded-lg bg-white p-2 text-sm shadow-sm hover:bg-slate-50">
                    <span className="bg-primary-gradient flex size-7 shrink-0 items-center justify-center rounded-full text-xs text-white">{p.candidate.fullName[0]}</span>
                    {p.candidate.fullName}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass p-5">
        <h2 className="mb-4 font-bold">פרטי המשרה</h2>
        <JobForm
          job={{ id, title: job.title, branchId: job.branchId, description: job.description, salary: job.salary === null ? null : Number(job.salary), openings: job.openings }}
          groups={groups.filter((g) => g.companyId === job.companyId)}
        />
      </section>
    </>
  );
}

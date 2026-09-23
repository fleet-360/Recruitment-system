import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Lock, LockOpen } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { canUseBranch } from "@/lib/access";
import { JobForm } from "@/app/(office)/jobs/job-form";
import { toggleJobStatus } from "@/app/(office)/jobs/actions";
import { myBranchGroups } from "../branch-groups";

// B-02 job: edit, close / reopen, and who is in process for it.
export default async function PortalJob({ params }: PageProps<"/portal/jobs/[id]">) {
  const user = await requireBusiness();
  const { id } = await params;
  const job = await db.job.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true } },
      placements: { orderBy: { createdAt: "asc" }, select: { id: true, candidate: { select: { fullName: true } }, status: { select: { label: true } } } },
    },
  });
  if (!job || !(await canUseBranch(user, job.branchId))) notFound();
  const groups = await myBranchGroups(user);
  const open = job.status === "open";

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white"><Briefcase size={24} /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-sm text-slate-500">{job.branch.name} · {job.openings} תקנים · נפתחה {job.createdAt.toLocaleDateString("he-IL")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{open ? "פתוחה" : "סגורה"}</span>
        <form action={toggleJobStatus.bind(null, id)}>
          <button className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50">
            {open ? <><Lock size={16} /> סגירת משרה</> : <><LockOpen size={16} /> פתיחה מחדש</>}
          </button>
        </form>
      </section>

      <section className="glass p-5">
        <JobForm
          job={{ id: job.id, title: job.title, branchId: job.branchId, description: job.description, salary: job.salary === null ? null : Number(job.salary), openings: job.openings }}
          groups={groups}
        />
      </section>

      <section className="glass space-y-2 p-5">
        <h2 className="font-bold">מועמדים למשרה ({job.placements.length})</h2>
        {job.placements.length === 0 ? (
          <p className="text-sm text-slate-500">המשרד עוד לא שייך מועמדים למשרה.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {job.placements.map((p) => (
              <li key={p.id}>
                <Link href={`/portal/candidates?open=${p.id}#${p.id}`} className="flex justify-between py-2 hover:text-violet-700">
                  <span className="font-medium">{p.candidate.fullName}</span>
                  <span className="text-slate-500">{p.status?.label ?? "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

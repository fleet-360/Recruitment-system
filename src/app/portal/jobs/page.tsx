import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { businessBranchIds } from "@/lib/access";
import { JobForm } from "@/app/(office)/jobs/job-form";
import { myBranchGroups } from "./branch-groups";

// B-02 jobs of my branches + open a job (no approval — the office gets a notification).
export default async function PortalJobs({ searchParams }: PageProps<"/portal/jobs">) {
  const user = await requireBusiness();
  const sp = await searchParams;
  const branchIds = await businessBranchIds(user);
  const [jobs, groups] = await Promise.all([
    db.job.findMany({
      where: { branchId: { in: branchIds } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { branch: { select: { name: true } }, _count: { select: { placements: true } } },
    }),
    myBranchGroups(user),
  ]);

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white"><Briefcase size={24} /></span>
        <div>
          <h1 className="text-2xl font-bold">משרות</h1>
          <p className="text-sm text-slate-500">{jobs.filter((j) => j.status === "open").length} פתוחות</p>
        </div>
      </section>

      <details className="glass p-5" open={sp.new === "1"}>
        <summary className="flex items-center gap-1 font-bold text-violet-700"><Plus size={18} /> פתיחת משרה</summary>
        <div className="pt-4">
          {groups.length ? <JobForm job={null} groups={groups} /> : <p className="text-sm text-slate-500">אין סניפים משויכים — פנו למשרד.</p>}
        </div>
      </details>

      {jobs.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Briefcase size={26} /></span>
          <h2 className="font-bold">אין משרות</h2>
          <p className="text-sm text-slate-500">פתחו את המשרה הראשונה</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-slate-500">
              <tr>
                {["משרה", "סניף", "תקנים", "מועמדים", "סטטוס", "נפתחה"].map((h) => <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="relative border-b border-slate-100 last:border-0 hover:bg-white/70">
                  <td className="px-4 py-3"><Link href={`/portal/jobs/${j.id}`} className="font-bold after:absolute after:inset-0">{j.title}</Link></td>
                  <td className="px-4 py-3">{j.branch.name}</td>
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

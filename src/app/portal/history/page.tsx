import { History } from "lucide-react";
import { requireBusiness } from "@/lib/session";
import { myPlacements, processSteps, stageOf } from "../data";

const day = (d: Date | null) => (d ? d.toLocaleDateString("he-IL", { timeZone: "UTC" }) : "—");

// B-04 finished processes: hired for good or fired. Read-only.
export default async function PortalHistory() {
  const user = await requireBusiness();
  const [placements, steps] = await Promise.all([myPlacements(user), processSteps()]);
  const hiredId = steps.at(-1)?.id;
  const rows = placements.map((p) => ({ ...p, stage: stageOf(p, hiredId) })).filter((p) => p.stage === "hired" || p.stage === "fired");

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white"><History size={24} /></span>
        <div>
          <h1 className="text-2xl font-bold">היסטוריה</h1>
          <p className="text-sm text-slate-500">מועמדים שסיימו תהליך — התקבלו סופית או סיימו לעבוד</p>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><History size={26} /></span>
          <h2 className="font-bold">אין עדיין היסטוריה</h2>
          <p className="text-sm text-slate-500">מועמדים שיתקבלו סופית או יסיימו לעבוד יופיעו כאן</p>
        </section>
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-slate-200/70 text-xs text-slate-500">
              <tr>
                {["מועמד", "משרה · סניף", "סטטוס", "התחלה", "סיום"].map((h) => <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-bold">{p.candidate.fullName}</td>
                  <td className="px-4 py-3">{p.job.title} · {p.job.branch.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${p.stage === "fired" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{p.status?.label}</span>
                  </td>
                  <td className="px-4 py-3">{day(p.startDate)}</td>
                  <td className="px-4 py-3">{p.endDate ? `${day(p.endDate)} · ${p.endReason}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

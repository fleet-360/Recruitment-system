import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { StatusStepper } from "@/components/status-stepper";
import { setPlacementStatus } from "@/app/(office)/placements/actions";
import { FireForm, RejectForm } from "@/app/(office)/placements/forms";
import { myPlacements, processSteps, stageOf, type Stage } from "../data";

const tabs: { key: Exclude<Stage, "fired">; label: string }[] = [
  { key: "active", label: "בתהליך" },
  { key: "hired", label: "התקבלו" },
  { key: "rejected", label: "נדחו" },
];

// B-03 candidates in my branches, limited view (name, city, summary). Move steps, reject with a reason, mark fired.
// ?open=<placementId> opens that card (links from the job page).
export default async function PortalCandidates({ searchParams }: PageProps<"/portal/candidates">) {
  const user = await requireBusiness();
  const sp = await searchParams;
  const [placements, steps, reasons] = await Promise.all([
    myPlacements(user),
    processSteps(),
    db.lookupValue.findMany({ where: { listKey: "rejection_reason", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true, requiresNote: true } }),
  ]);
  const hiredId = steps.at(-1)?.id;
  const rows = placements.map((p) => ({ ...p, stage: stageOf(p, hiredId) }));

  const openId = typeof sp.open === "string" ? sp.open : undefined;
  const opened = rows.find((r) => r.id === openId);
  if (opened?.stage === "fired") redirect("/portal/history");
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? opened?.stage ?? "active";
  const shown = rows.filter((r) => r.stage === tab);

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white"><Users size={24} /></span>
        <div>
          <h1 className="text-2xl font-bold">מועמדים</h1>
          <p className="text-sm text-slate-500">מועמדים שהמשרד שייך למשרות בסניפים שלך</p>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/portal/candidates?tab=${t.key}`}
            replace
            aria-current={t.key === tab ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap ${t.key === tab ? "bg-primary-gradient text-white" : "glass text-slate-600"}`}
          >
            {t.label}
            <span className={`rounded-full px-2 text-xs ${t.key === tab ? "bg-white/30" : "bg-slate-100"}`}>{rows.filter((r) => r.stage === t.key).length}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Users size={26} /></span>
          <h2 className="font-bold">אין מועמדים כאן</h2>
          <p className="text-sm text-slate-500">כשהמשרד ישייך מועמדים למשרות שלך, הם יופיעו כאן</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id} id={p.id}>
              <details open={p.id === openId} className="glass group p-4">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="bg-accent-gradient flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white">
                    {p.candidate.fullName.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{p.candidate.fullName}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      {p.candidate.city && <span className="flex items-center gap-0.5"><MapPin size={12} />{p.candidate.city.label}</span>}
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">{p.job.title} · {p.job.branch.name}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${p.stage === "rejected" ? "bg-red-50 text-red-600" : p.stage === "hired" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {p.status?.label ?? "—"}
                  </span>
                </summary>

                <div className="mt-4 space-y-3">
                  {p.candidate.summary && <p className="rounded-xl bg-white/60 p-3 text-sm whitespace-pre-line">{p.candidate.summary}</p>}
                  <StatusStepper steps={steps} currentId={p.stage === "rejected" ? null : p.statusId} action={setPlacementStatus.bind(null, p.id)} />
                  {p.stage === "rejected" ? (
                    <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      {p.status!.label}: {[p.rejectionReason?.label, p.rejectionNote].filter(Boolean).join(" — ")}
                      <span className="block text-xs text-red-500">לחיצה על שלב בסטפר מחזירה את המועמד לתהליך.</span>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {p.startDate && <p className="text-sm text-slate-600">התחיל/ה לעבוד ב-{p.startDate.toLocaleDateString("he-IL", { timeZone: "UTC" })}</p>}
                      <details className="rounded-xl bg-white/60 p-3">
                        <summary className="text-sm font-medium text-red-600">דחייה</summary>
                        <div className="pt-3"><RejectForm placementId={p.id} reasons={reasons} /></div>
                      </details>
                      {p.startDate && (
                        <details className="rounded-xl bg-white/60 p-3">
                          <summary className="text-sm font-medium text-red-600">פוטר / סיים לעבוד</summary>
                          <div className="pt-3"><FireForm placementId={p.id} /></div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

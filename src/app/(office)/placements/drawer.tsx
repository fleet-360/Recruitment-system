import Link from "next/link";
import { ArrowLeftRight, Coins, StickyNote, X } from "lucide-react";
import { db } from "@/lib/db";
import { today, type FeeType } from "@/lib/fees";
import { StatusStepper } from "@/components/status-stepper";
import { setPlacementStatus } from "./actions";
import { FireForm, RejectForm, StartForm } from "./forms";

const day = (d: Date) => d.toLocaleDateString("he-IL", { timeZone: "UTC" });
const when = (d: Date) => d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
const shekel = (n: unknown) => `${Number(n).toLocaleString("he-IL", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })} ₪`;

// S-11 placement side drawer, opened with ?p=<id> on the job page or the candidate card.
// Callers must have checked office access (requireOffice) — this renders internal data.
export async function PlacementDrawer({ placementId, closeHref }: { placementId: string; closeHref: string }) {
  const p = await db.placement.findUnique({
    where: { id: placementId },
    include: {
      candidate: { select: { id: true, fullName: true } },
      status: true,
      rejectionReason: { select: { label: true } },
      installments: { orderBy: { seq: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } },
      job: {
        select: {
          id: true,
          title: true,
          salary: true,
          company: { select: { id: true, name: true } },
          branch: { select: { name: true, feeType: true, feeValue: true, paymentTerms: { orderBy: { seq: "asc" } } } },
        },
      },
    },
  });
  if (!p) return null;

  const [steps, reasons] = await Promise.all([
    // rejected / fired aren't clickable steps — they have their own forms below
    db.lookupValue.findMany({ where: { listKey: "placement_status", isActive: true, systemKey: null }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true } }),
    db.lookupValue.findMany({ where: { listKey: "rejection_reason", isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true, requiresNote: true } }),
  ]);

  const closed = p.status?.systemKey; // "rejected" | "fired" | null
  const snapshot = p.installments.length > 0;
  const b = p.job.branch;
  const terms = snapshot
    ? { feeType: p.feeType as FeeType, feeValue: Number(p.feeValue), rows: p.installments.map((i) => ({ sharePercent: Number(i.sharePercent), daysAfterStart: i.daysAfterStart })) }
    : b.feeType
      ? { feeType: b.feeType, feeValue: Number(b.feeValue), rows: b.paymentTerms.map((t) => ({ sharePercent: Number(t.sharePercent), daysAfterStart: t.daysAfterStart })) }
      : null;
  const now = today();

  return (
    <>
      <Link href={closeHref} scroll={false} aria-label="סגירה" className="fixed inset-0 z-40 bg-slate-900/30" />
      <aside className="glass fixed inset-y-0 end-0 z-50 w-full max-w-md space-y-4 overflow-y-auto rounded-none p-5 sm:rounded-s-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold">
              <Link href={`/candidates/${p.candidate.id}`} className="hover:underline">{p.candidate.fullName}</Link>
            </h2>
            <p className="text-sm text-slate-500">
              <Link href={`/jobs/${p.job.id}`} className="text-violet-700 hover:underline">{p.job.title}</Link> · {p.job.company.name} · {b.name}
            </p>
          </div>
          <Link href={closeHref} scroll={false} aria-label="סגירה" className="rounded-lg p-1 hover:bg-white/70"><X size={20} /></Link>
        </div>

        <StatusStepper steps={steps} currentId={closed ? null : p.statusId} action={setPlacementStatus.bind(null, p.id)} />
        {closed && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {closed === "fired"
              ? `${p.status!.label} ב-${day(p.endDate!)}: ${p.endReason}`
              : `${p.status!.label}: ${[p.rejectionReason?.label, p.rejectionNote].filter(Boolean).join(" — ")}`}
            <span className="block text-xs text-red-500">לחיצה על שלב בסטפר פותחת את ההשמה מחדש.</span>
          </p>
        )}

        <section className="space-y-2 rounded-xl bg-white/60 p-3">
          <h3 className="font-bold">התחלת עבודה ופעימות</h3>
          {closed ? (
            <p className="text-sm text-slate-600">
              {p.startDate ? `תאריך התחלה ${day(p.startDate)}${p.salary ? ` · שכר ${shekel(p.salary)}` : ""}` : "לא התחיל לעבוד"}
            </p>
          ) : (
            <StartForm
              placementId={p.id}
              startDate={p.startDate?.toISOString().slice(0, 10) ?? null}
              salary={p.salary !== null ? Number(p.salary) : p.job.salary !== null ? Number(p.job.salary) : null}
              terms={terms}
              hasInstallments={snapshot}
              companyHref={`/companies/${p.job.company.id}`}
            />
          )}
          {snapshot && (
            <table className="w-full text-sm">
              <tbody>
                {p.installments.map((i) => {
                  const late = i.status === "expected" && i.dueDate < now;
                  return (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="py-1.5">{i.seq}</td>
                      <td className="py-1.5">{day(i.dueDate)}</td>
                      <td className={`py-1.5 ${i.status === "cancelled" ? "text-slate-400 line-through" : ""}`}>{shekel(i.amount)}</td>
                      <td className="py-1.5 text-end">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          i.status === "paid" ? "bg-emerald-50 text-emerald-700" : i.status === "cancelled" ? "bg-slate-100 text-slate-500" : late ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-700"
                        }`}>
                          {i.status === "paid" ? "שולם" : i.status === "cancelled" ? "בוטל" : late ? "באיחור" : "צפוי"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {!closed && (
          <div className="space-y-2">
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

        <section className="space-y-2">
          <h3 className="font-bold">היסטוריה</h3>
          <ul className="space-y-2 text-sm">
            {p.activities.map((a) => (
              <li key={a.id} className="flex gap-2 rounded-xl bg-white/60 p-3">
                {a.type === "status_change" ? <ArrowLeftRight size={16} className="mt-0.5 shrink-0 text-violet-500" /> : a.type === "billing" ? <Coins size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <StickyNote size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                <div className="flex-1">
                  <p>{a.type === "status_change" ? `סטטוס: ${a.fromValue ?? "—"} ← ${a.toValue}` : a.body}</p>
                  {a.type === "status_change" && a.body && <p className="text-slate-600">{a.body}</p>}
                  <p className="text-xs text-slate-400">{a.user?.name ?? a.user?.email ?? "מערכת"} · {when(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </>
  );
}

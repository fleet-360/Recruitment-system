"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { keepValues } from "@/lib/keep-values";
import { planInstallments, type FeeType, type TermRow } from "@/lib/fees";
import type { Option } from "@/lib/lookups";
import { firePlacement, rejectPlacement, saveStart, type FormState } from "./actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-2.5";
const shekel = (n: number) => n.toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });

function Result({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending) return null;
  if (state?.error) return <p className="text-red-600">{state.error}</p>;
  if (state?.warning) return <p className="text-amber-700">{state.warning}</p>;
  if (state?.ok) return <p className="text-emerald-600">נשמר</p>;
  return null;
}

// Start date + salary. Shows the installments that saving will create (or recalculate).
export function StartForm({
  placementId,
  startDate,
  salary,
  terms,
  hasInstallments,
  companyHref,
}: {
  placementId: string;
  startDate: string | null;
  salary: number | null;
  terms: { feeType: FeeType; feeValue: number; rows: TermRow[] } | null;
  hasInstallments: boolean;
  companyHref: string;
}) {
  const [state, action, pending] = useActionState(saveStart.bind(null, placementId), null);
  const [start, setStart] = useState(startDate ?? "");
  const [pay, setPay] = useState(salary ?? 0);
  const preview = terms && start ? planInstallments(new Date(start), terms.feeType, terms.feeValue, pay || null, terms.rows) : null;

  return (
    <form onSubmit={keepValues(action)} className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <label>
          תאריך התחלה
          <input name="startDate" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={field} />
        </label>
        <label>
          שכר חודשי (₪){terms?.feeType === "percent_of_salary" && <span className="text-red-500"> *</span>}
          <input name="salary" type="number" min="1" step="1" value={pay || ""} onChange={(e) => setPay(Number(e.target.value))} className={field} />
        </label>
      </div>
      {!terms ? (
        <p className="rounded-lg bg-amber-50 p-2 text-amber-800">
          לסניף אין תנאי תשלום — לא ייווצרו פעימות.{" "}
          <Link href={companyHref} className="font-bold underline">הגדרת תנאים</Link>
        </p>
      ) : (
        !hasInstallments &&
        preview && (
          <div className="rounded-lg bg-white/70 p-2">
            <p className="mb-1 text-xs text-slate-500">ייווצרו בשמירה (לפני מע&quot;מ):</p>
            {preview.map((i) => (
              <p key={i.seq} className="flex justify-between">
                <span>פעימה {i.seq} · {i.dueDate.toLocaleDateString("he-IL", { timeZone: "UTC" })}</span>
                <span>{shekel(i.amount)}</span>
              </p>
            ))}
          </div>
        )
      )}
      {terms?.feeType === "percent_of_salary" && start && !pay && <p className="text-amber-700">העמלה באחוז משכר — יש להזין שכר</p>}
      <button disabled={pending} className="bg-accent-gradient rounded-xl px-5 py-2 font-medium text-white disabled:opacity-50">
        {pending ? "שומר…" : hasInstallments ? "שמירה וחישוב מחדש" : "שמירה"}
      </button>
      <Result state={state} pending={pending} />
    </form>
  );
}

export function RejectForm({ placementId, reasons }: { placementId: string; reasons: (Option & { requiresNote: boolean })[] }) {
  const [state, action, pending] = useActionState(rejectPlacement.bind(null, placementId), null);
  const [reasonId, setReasonId] = useState("");
  const needsNote = reasons.find((r) => r.id === reasonId)?.requiresNote;

  return (
    <form onSubmit={keepValues(action)} className="space-y-2 text-sm">
      <select name="rejectionReasonId" required value={reasonId} onChange={(e) => setReasonId(e.target.value)} aria-label="סיבת דחייה" className={field}>
        <option value="">— סיבת דחייה —</option>
        {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      <textarea name="rejectionNote" required={needsNote} rows={2} placeholder={needsNote ? "פירוט (חובה)" : "פירוט (לא חובה)"} aria-label="פירוט" className={field} />
      <p className="text-xs text-slate-500">פעימות שמועדן עוד לא הגיע יבוטלו.</p>
      <button disabled={pending} className="rounded-xl bg-red-500 px-5 py-2 font-medium text-white disabled:opacity-50">{pending ? "שומר…" : "דחייה"}</button>
      <Result state={state} pending={pending} />
    </form>
  );
}

export function FireForm({ placementId }: { placementId: string }) {
  const [state, action, pending] = useActionState(firePlacement.bind(null, placementId), null);
  return (
    <form onSubmit={keepValues(action)} className="space-y-2 text-sm">
      <label className="block">
        תאריך סיום
        <input name="endDate" type="date" required className={field} />
      </label>
      <textarea name="endReason" required minLength={2} rows={2} placeholder="סיבה" aria-label="סיבה" className={field} />
      <p className="text-xs text-slate-500">פעימות שמועדן אחרי תאריך הסיום יבוטלו; פעימות שכבר הגיע מועדן נשארות לגבייה.</p>
      <button disabled={pending} className="rounded-xl bg-red-500 px-5 py-2 font-medium text-white disabled:opacity-50">{pending ? "שומר…" : "סימון פוטר"}</button>
      <Result state={state} pending={pending} />
    </form>
  );
}

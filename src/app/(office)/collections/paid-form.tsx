"use client";

import { useActionState } from "react";
import { Check, Undo2 } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import { markPaid, unmarkPaid } from "./actions";

// "Mark paid" with the payment date (defaults to today).
export function PaidForm({ installmentId, today }: { installmentId: string; today: string }) {
  const [state, action, pending] = useActionState(markPaid.bind(null, installmentId), null);

  return (
    <form onSubmit={keepValues(action)} className="flex flex-wrap items-center justify-end gap-1.5">
      <input name="paidAt" type="date" required defaultValue={today} max={today} aria-label="תאריך תשלום" className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs" />
      <button disabled={pending} className="bg-primary-gradient flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-60">
        <Check size={14} /> שולם
      </button>
      {state?.error && <p className="w-full text-end text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function UnpaidButton({ installmentId }: { installmentId: string }) {
  return (
    <form
      action={unmarkPaid.bind(null, installmentId)}
      onSubmit={(e) => {
        if (!confirm("לבטל את סימון התשלום? הפעימה תחזור לצפוי.")) e.preventDefault();
      }}
    >
      <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/70 hover:text-red-600">
        <Undo2 size={14} /> ביטול סימון
      </button>
    </form>
  );
}

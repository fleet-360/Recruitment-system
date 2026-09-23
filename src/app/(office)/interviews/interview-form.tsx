"use client";

import { useActionState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import type { Option } from "@/lib/lookups";
import { cancelInterview, createInterview } from "./actions";

// Schedule an interview from the candidate card: when (Israel time), for which placement (optional), where.
export function InterviewForm({ candidateId, placements, min }: { candidateId: string; placements: Option[]; min: string }) {
  const [state, action, pending] = useActionState(createInterview.bind(null, candidateId), null);
  const field = "rounded-xl border border-slate-200 bg-white p-2.5 text-sm";

  return (
    <form key={state?.savedAt} onSubmit={keepValues(action)} className="flex flex-wrap gap-2">
      <input name="scheduledAt" type="datetime-local" required min={min} aria-label="מועד הראיון" className={field} />
      {placements.length > 0 && (
        <select name="placementId" defaultValue="" aria-label="משרה" className={`${field} min-w-40 flex-1`}>
          <option value="">ראיון במשרד (בלי משרה)</option>
          {placements.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      )}
      <input name="location" maxLength={200} placeholder="מיקום / קישור" aria-label="מיקום" className={`${field} min-w-40 flex-1`} />
      <button disabled={pending} className="bg-primary-gradient flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        <CalendarPlus size={16} /> קביעת ראיון
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function CancelInterviewButton({ id }: { id: string }) {
  return (
    <form
      action={cancelInterview.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("לבטל את הראיון? הביטול יירשם בהיסטוריה של המועמד.")) e.preventDefault();
      }}
    >
      <button title="ביטול ראיון" aria-label="ביטול ראיון" className="rounded-lg p-1 text-slate-400 hover:bg-white/70 hover:text-red-600">
        <X size={16} />
      </button>
    </form>
  );
}

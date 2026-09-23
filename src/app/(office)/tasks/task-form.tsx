"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import type { Option } from "@/lib/lookups";
import { createTask } from "./actions";

// New task: what, when (date only), who. On the tasks screen and on the candidate card (with candidateId).
export function TaskForm({ candidateId = null, users, meId, today }: { candidateId?: string | null; users: Option[]; meId: string; today: string }) {
  const [state, action, pending] = useActionState(createTask.bind(null, candidateId), null);
  const field = "rounded-xl border border-slate-200 bg-white p-2.5 text-sm";

  return (
    <form key={state?.savedAt} onSubmit={keepValues(action)} className="flex flex-wrap gap-2">
      <input name="title" required maxLength={200} placeholder={candidateId ? "משימה חדשה למועמד…" : "משימה חדשה…"} aria-label="משימה" className={`${field} min-w-48 flex-1`} />
      <input name="dueAt" type="date" required defaultValue={today} min={today} aria-label="תאריך" className={field} />
      <select name="assignedToId" defaultValue={meId} aria-label="אחראי" className={field}>
        {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
      <button disabled={pending} className="bg-primary-gradient flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        <Plus size={16} /> הוספה
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

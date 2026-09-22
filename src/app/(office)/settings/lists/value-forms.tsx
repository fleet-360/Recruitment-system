"use client";

import { useActionState } from "react";
import { keepValues } from "@/lib/keep-values";
import { Plus } from "lucide-react";
import type { ListKey } from "@/generated/prisma/client";
import type { Option } from "@/lib/lookups";
import { addValue, updateValue } from "./actions";

const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";

function RegionSelect({ regions, defaultValue }: { regions: Option[]; defaultValue?: string | null }) {
  return (
    <select name="parentId" defaultValue={defaultValue ?? ""} required className={field} aria-label="אזור">
      <option value="">— אזור —</option>
      {regions.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

export function EditValueForm({
  value,
  listKey,
  regions,
}: {
  value: { id: string; label: string; parentId: string | null; requiresNote: boolean };
  listKey: ListKey;
  regions: Option[];
}) {
  const [state, action, pending] = useActionState(updateValue.bind(null, value.id), null);

  return (
    <form onSubmit={keepValues(action)} className="flex flex-1 flex-wrap items-center gap-2">
      <input name="label" defaultValue={value.label} required maxLength={80} aria-label="שם" className={`${field} min-w-40 flex-1`} />
      {listKey === "city" && <RegionSelect regions={regions} defaultValue={value.parentId} />}
      {listKey === "rejection_reason" && (
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" name="requiresNote" defaultChecked={value.requiresNote} className="size-4 accent-emerald-500" />
          דורש פירוט
        </label>
      )}
      <button disabled={pending} className="rounded-xl px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-50">
        {pending ? "שומר…" : "שמירה"}
      </button>
      {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function AddValueForm({ listKey, regions }: { listKey: ListKey; regions: Option[] }) {
  const [state, action, pending] = useActionState(addValue.bind(null, listKey), null);

  return (
    // key resets the inputs after each successful add
    <form key={state?.savedAt ?? "add"} onSubmit={keepValues(action)} className="flex flex-wrap items-center gap-2">
      <input name="label" required maxLength={80} placeholder="ערך חדש" aria-label="ערך חדש" className={`${field} min-w-40 flex-1`} />
      {listKey === "city" && <RegionSelect regions={regions} />}
      <button disabled={pending} className="bg-accent-gradient flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        <Plus size={16} /> הוספה
      </button>
      {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

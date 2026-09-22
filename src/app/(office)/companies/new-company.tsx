"use client";

import { useActionState, useRef } from "react";
import { keepValues } from "@/lib/keep-values";
import { Building2, X } from "lucide-react";
import type { Option } from "@/lib/lookups";
import { createCompany } from "./actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-3";

export function NewCompany({ cities }: { cities: Option[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createCompany, null);

  return (
    <>
      <button onClick={() => dialog.current?.showModal()} className="bg-accent-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-white">
        <Building2 size={18} /> חברה חדשה
      </button>

      <dialog ref={dialog} className="glass m-auto w-[min(28rem,calc(100%-2rem))] p-6 backdrop:bg-slate-900/30">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">חברה חדשה</h2>
          <button onClick={() => dialog.current?.close()} aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={keepValues(action)} className="space-y-3">
          <label className="block text-sm">
            שם החברה <span className="text-red-500">*</span>
            <input name="name" required minLength={2} autoFocus className={field} />
          </label>
          <label className="block text-sm">
            ח.פ.
            <input name="regNumber" dir="ltr" className={`${field} text-end`} />
          </label>
          <label className="block text-sm">
            עיר הסניף הראשי
            <select name="cityId" defaultValue="" className={field}>
              <option value="">— בחר עיר —</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-500">נוצר סניף ראשון בשם &quot;ראשי&quot; — אפשר לשנות את שמו ולהוסיף סניפים בכרטיס החברה.</p>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button disabled={pending} className="bg-accent-gradient w-full rounded-xl p-3 font-medium text-white disabled:opacity-50">
            {pending ? "שומר…" : "יצירה"}
          </button>
        </form>
      </dialog>
    </>
  );
}

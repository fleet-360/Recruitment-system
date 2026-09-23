"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import { TempPassword } from "@/app/(office)/settings/users/user-form";
import { createBranchManager } from "./actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-2.5";

export function ManagerForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createBranchManager, null);

  return (
    <div className="space-y-3">
      <form key={state?.savedAt} onSubmit={keepValues(action)} className="grid gap-3 text-sm sm:grid-cols-2">
        <label>
          שם מלא <span className="text-red-500">*</span>
          <input name="name" required maxLength={80} className={field} />
        </label>
        <label>
          אימייל (שם משתמש) <span className="text-red-500">*</span>
          <input name="email" type="email" required dir="ltr" className={field} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend>סניפים <span className="text-red-500">*</span></legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {branches.map((b) => (
              <label key={b.id} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2">
                <input type="checkbox" name="branchIds" value={b.id} defaultChecked={branches.length === 1} />
                {b.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-2 sm:col-span-2">
          {state?.error && <p className="text-red-600">{state.error}</p>}
          <button disabled={pending} className="bg-accent-gradient flex w-full items-center justify-center gap-2 rounded-xl p-3 font-medium text-white disabled:opacity-60">
            <UserPlus size={18} /> {pending ? "יוצר…" : "הוספת מנהל/ת סניף"}
          </button>
        </div>
      </form>
      <TempPassword state={state} />
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { keepValues } from "@/lib/keep-values";
import { changePassword } from "./actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-3";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <form onSubmit={keepValues(action)} className="space-y-3 text-sm">
      <label className="block">
        סיסמה נוכחית
        <input name="current" type="password" required autoComplete="current-password" dir="ltr" className={field} />
      </label>
      <label className="block">
        סיסמה חדשה (לפחות 8 תווים)
        <input name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={field} />
      </label>
      <label className="block">
        אימות סיסמה חדשה
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={field} />
      </label>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      <button disabled={pending} className="bg-accent-gradient w-full rounded-xl p-3 font-medium text-white disabled:opacity-60">שמירה</button>
    </form>
  );
}

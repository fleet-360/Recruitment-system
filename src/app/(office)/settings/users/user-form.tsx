"use client";

import { useActionState, useState } from "react";
import { KeyRound, Save, UserPlus } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import type { Role } from "@/generated/prisma/client";
import { roleNames } from "./roles";
import { createUser, resetPassword, updateUser, type UserFormState } from "./actions";

export type CompanyBranches = { id: string; name: string; branches: { id: string; name: string }[] };
type EditUser = { id: string; name: string | null; email: string; role: Role; companyId: string | null; branchIds: string[]; isActive: boolean };

const field = "w-full rounded-xl border border-slate-200 bg-white p-2.5";

// Shown once — the admin passes it on; the user must change it at first login.
export function TempPassword({ state }: { state: UserFormState }) {
  if (!state?.tempPassword) return null;
  return (
    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
      סיסמה זמנית (מוצגת פעם אחת בלבד — העבירו למשתמש):
      <code dir="ltr" className="ms-2 rounded bg-white px-2 py-1 font-mono text-base font-bold select-all">{state.tempPassword}</code>
    </div>
  );
}

export function UserForm({ user, companies }: { user: EditUser | null; companies: CompanyBranches[] }) {
  const [state, action, pending] = useActionState(user ? updateUser.bind(null, user.id) : createUser, null);
  const [role, setRole] = useState<Role>(user?.role ?? "recruiter");
  const [companyId, setCompanyId] = useState(user?.companyId ?? "");
  const business = role === "company_admin" || role === "branch_manager";
  const branches = companies.find((c) => c.id === companyId)?.branches ?? [];

  return (
    <div className="space-y-3">
      <form key={user ? undefined : state?.savedAt} onSubmit={keepValues(action)} className="grid gap-3 text-sm sm:grid-cols-2">
        <label>
          שם מלא <span className="text-red-500">*</span>
          <input name="name" required defaultValue={user?.name ?? ""} maxLength={80} className={field} />
        </label>
        <label>
          אימייל (שם משתמש) <span className="text-red-500">*</span>
          <input name="email" type="email" required defaultValue={user?.email ?? ""} dir="ltr" className={field} />
        </label>
        <label>
          תפקיד <span className="text-red-500">*</span>
          <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
            {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
          </select>
        </label>
        {business && (
          <label>
            חברה <span className="text-red-500">*</span>
            <select name="companyId" required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={field}>
              <option value="">— בחירת חברה —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {role === "branch_manager" && companyId && (
          <fieldset className="sm:col-span-2">
            <legend>סניפים <span className="text-red-500">*</span></legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2">
                  <input type="checkbox" name="branchIds" value={b.id} defaultChecked={user?.branchIds.includes(b.id)} />
                  {b.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {role === "company_admin" && <p className="text-slate-500 sm:col-span-2">מנהל חברה רואה את כל הסניפים של החברה.</p>}
        {user && (
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" name="isActive" defaultChecked={user.isActive} className="size-4" />
            משתמש פעיל (משתמש מושבת לא יכול להיכנס, מיד)
          </label>
        )}
        <div className="space-y-2 sm:col-span-2">
          {state?.error && <p className="text-red-600">{state.error}</p>}
          {!pending && state?.ok && user && <p className="text-emerald-600">נשמר</p>}
          <button disabled={pending} className="bg-accent-gradient flex w-full items-center justify-center gap-2 rounded-xl p-3 font-medium text-white disabled:opacity-60">
            {user ? <><Save size={18} /> שמירה</> : <><UserPlus size={18} /> יצירת משתמש</>}
          </button>
        </div>
      </form>
      {!user && <TempPassword state={state} />}
    </div>
  );
}

// `reset` lets the portal pass its own (company-scoped) action.
export function ResetPasswordForm({ userId, reset = resetPassword }: { userId: string; reset?: (userId: string) => Promise<UserFormState> }) {
  const [state, action, pending] = useActionState(reset.bind(null, userId), null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("ליצור סיסמה זמנית חדשה? הסיסמה הנוכחית תפסיק לעבוד.")) e.preventDefault();
      }}
      className="space-y-2 text-sm"
    >
      <button disabled={pending} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-medium text-violet-700 shadow-sm hover:shadow disabled:opacity-60">
        <KeyRound size={16} /> איפוס סיסמה
      </button>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      <TempPassword state={state} />
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { keepValues } from "@/lib/keep-values";
import { Plus, Trash2 } from "lucide-react";
import type { Option } from "@/lib/lookups";
import { splitFee, type FeeType } from "@/lib/fees";
import { deleteContact, saveBranch, saveContact, updateCompany, type FormState } from "../actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-2.5";
const Req = () => <span className="text-red-500">*</span>;
const shekel = (n: number) => n.toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });

function Submit({ pending, state, label = "שמירה" }: { pending: boolean; state: FormState; label?: string }) {
  return (
    <div className="flex items-center gap-3 sm:col-span-2">
      <button disabled={pending} className="bg-accent-gradient rounded-xl px-6 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "שומר…" : label}
      </button>
      {state?.error && <span className="text-red-600">{state.error}</span>}
      {state?.ok && !pending && <span className="text-emerald-600">נשמר</span>}
    </div>
  );
}

export function CompanyForm({ company: c }: { company: { id: string; name: string; regNumber: string | null; notes: string | null } }) {
  const [state, action, pending] = useActionState(updateCompany.bind(null, c.id), null);
  return (
    <form onSubmit={keepValues(action)} className="grid gap-3 text-sm sm:grid-cols-2">
      <label>
        שם החברה <Req />
        <input name="name" defaultValue={c.name} required minLength={2} className={field} />
      </label>
      <label>
        ח.פ.
        <input name="regNumber" defaultValue={c.regNumber ?? ""} dir="ltr" className={`${field} text-end`} />
      </label>
      <label className="sm:col-span-2">
        הערות
        <textarea name="notes" defaultValue={c.notes ?? ""} rows={3} className={field} />
      </label>
      <Submit pending={pending} state={state} />
    </form>
  );
}

export type BranchValue = {
  id: string;
  name: string;
  cityId: string | null;
  address: string | null;
  feeType: FeeType | null;
  feeValue: number | null;
  terms: { sharePercent: number; daysAfterStart: number }[];
};

// Branch details + payment terms editor (REQ-15): none / fixed ₪ / % of monthly salary, split into installments.
export function BranchForm({ companyId, branch, cities }: { companyId: string; branch: BranchValue | null; cities: Option[] }) {
  const [state, action, pending] = useActionState(saveBranch.bind(null, companyId, branch?.id ?? null), null);
  const [feeType, setFeeType] = useState<FeeType | "">(branch?.feeType ?? "");
  const [feeValue, setFeeValue] = useState(branch?.feeValue ?? 0);
  const [rows, setRows] = useState(branch?.terms.length ? branch.terms : [{ sharePercent: 100, daysAfterStart: 0 }]);

  const sum = rows.reduce((s, r) => s + Math.round((r.sharePercent || 0) * 100), 0) / 100;
  // splitFee puts the remainder on the last row, so it's only right once the shares add up.
  const amounts = feeType !== "fixed" || !(feeValue > 0) ? null : sum === 100 ? splitFee(feeValue, rows) : rows.map((r) => Math.round(feeValue * (r.sharePercent || 0)) / 100);
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    // a new-branch form resets after each save
    <form
      key={branch ? branch.id : state?.savedAt}
      onSubmit={keepValues(action)}
      className="grid gap-3 text-sm sm:grid-cols-2"
    >
      <label>
        שם הסניף <Req />
        <input name="name" defaultValue={branch?.name} required className={field} />
      </label>
      <label>
        עיר
        <select name="cityId" defaultValue={branch?.cityId ?? ""} className={field}>
          <option value="">— בחר עיר —</option>
          {cities.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2">
        כתובת
        <input name="address" defaultValue={branch?.address ?? ""} className={field} />
      </label>

      {branch && (
        <fieldset className="space-y-3 rounded-xl bg-white/60 p-3 sm:col-span-2">
          <legend className="font-medium">תנאי תשלום <span className="text-xs font-normal text-slate-400">(לפני מע&quot;מ)</span></legend>
          <div className="flex flex-wrap gap-2">
            {([["", "ללא"], ["fixed", "סכום קבוע"], ["percent_of_salary", "אחוז משכר"]] as const).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="feeType" value={value} checked={feeType === value} onChange={() => setFeeType(value)} className="peer sr-only" />
                <span className="block rounded-full border border-slate-200 bg-white px-3 py-1 peer-checked:border-transparent peer-checked:bg-emerald-500 peer-checked:text-white peer-focus-visible:ring-2">
                  {label}
                </span>
              </label>
            ))}
          </div>

          {feeType && (
            <>
              <label className="block max-w-60">
                {feeType === "fixed" ? "עמלה (₪)" : "אחוז משכר חודשי אחד"} <Req />
                <input
                  name="feeValue"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={feeValue || ""}
                  onChange={(e) => setFeeValue(Number(e.target.value))}
                  className={field}
                />
              </label>

              <table className="w-full">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 text-start font-medium">פעימה</th>
                    <th className="py-1 text-start font-medium">% מהעמלה</th>
                    <th className="py-1 text-start font-medium">ימים מתחילת עבודה</th>
                    <th className="py-1 text-start font-medium">{feeType === "fixed" ? "סכום" : "משכר"}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 pe-2">
                        <input name="share" type="number" min="0.01" max="100" step="0.01" required value={r.sharePercent || ""} onChange={(e) => setRow(i, { sharePercent: Number(e.target.value) })} aria-label={`אחוז פעימה ${i + 1}`} className={field} />
                      </td>
                      <td className="py-1 pe-2">
                        <input name="days" type="number" min="0" step="1" required value={r.daysAfterStart} onChange={(e) => setRow(i, { daysAfterStart: Number(e.target.value) })} aria-label={`ימים לפעימה ${i + 1}`} className={field} />
                      </td>
                      <td className="py-1 whitespace-nowrap text-slate-500">
                        {amounts ? shekel(amounts[i]) : feeType === "percent_of_salary" && feeValue ? `${Math.round(feeValue * r.sharePercent) / 100}%` : "—"}
                      </td>
                      <td className="py-1">
                        {rows.length > 1 && (
                          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`הסרת פעימה ${i + 1}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRows([...rows, { sharePercent: Math.max(0, Math.round((100 - sum) * 100) / 100), daysAfterStart: (rows.at(-1)?.daysAfterStart ?? 0) + 30 }])}
                  className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-violet-700 hover:bg-violet-50"
                >
                  <Plus size={16} /> פעימה
                </button>
                <span className={sum === 100 ? "text-emerald-600" : "text-red-600"}>סה&quot;כ {sum}%</span>
              </div>
            </>
          )}
        </fieldset>
      )}

      <Submit pending={pending} state={state} label={branch ? "שמירה" : "הוספת סניף"} />
    </form>
  );
}

export type ContactValue = { id: string; name: string; role: string | null; phone: string | null; email: string | null; branchId: string | null };

export function ContactForm({ companyId, contact: c, branches }: { companyId: string; contact: ContactValue | null; branches: Option[] }) {
  const [state, action, pending] = useActionState(saveContact.bind(null, companyId, c?.id ?? null), null);
  return (
    <form key={c ? c.id : state?.savedAt} onSubmit={keepValues(action)} className="grid gap-2 text-sm sm:grid-cols-2">
      <input name="name" defaultValue={c?.name} required minLength={2} placeholder="שם *" aria-label="שם" className={field} />
      <input name="role" defaultValue={c?.role ?? ""} placeholder="תפקיד" aria-label="תפקיד" className={field} />
      <input name="phone" type="tel" defaultValue={c?.phone ?? ""} placeholder="טלפון" aria-label="טלפון" dir="ltr" className={`${field} text-end`} />
      <input name="email" type="email" defaultValue={c?.email ?? ""} placeholder="אימייל" aria-label="אימייל" dir="ltr" className={`${field} text-end`} />
      <select name="branchId" defaultValue={c?.branchId ?? ""} aria-label="סניף" className={`${field} sm:col-span-2`}>
        <option value="">כל החברה</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <Submit pending={pending} state={state} label={c ? "שמירה" : "הוספת איש קשר"} />
    </form>
  );
}

export function DeleteContactButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteContact.bind(null, id)} onSubmit={(e) => { if (!confirm(`למחוק את איש הקשר "${name}"?`)) e.preventDefault(); }}>
      <button aria-label={`מחיקת ${name}`} title="מחיקה" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
        <Trash2 size={16} />
      </button>
    </form>
  );
}

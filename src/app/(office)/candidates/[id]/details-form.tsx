"use client";

import { useActionState, useState } from "react";
import { keepValues } from "@/lib/keep-values";
import type { Option } from "@/lib/lookups";
import { calcAge } from "@/lib/age";
import { updateCandidate } from "../actions";

type Candidate = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  birthDate: string | null; // yyyy-mm-dd
  age: number | null; // manual entry, only meaningful when birthDate is null
  idNumber: string | null;
  cityId: string | null;
  sourceId: string | null;
  previousExperience: string | null;
  summary: string | null;
  marketingConsent: boolean;
  languageIds: string[];
};

const field = "w-full rounded-xl border border-slate-200 bg-white p-2.5";
const Req = () => <span className="text-red-500">*</span>;

export function DetailsForm({
  candidate: c,
  cities,
  sources,
  languages,
}: {
  candidate: Candidate;
  cities: Option[];
  sources: Option[];
  languages: Option[];
}) {
  const [state, action, pending] = useActionState(updateCandidate.bind(null, c.id), null);
  const [birthDate, setBirthDate] = useState(c.birthDate ?? "");

  return (
    <form onSubmit={keepValues(action)} className="grid gap-3 text-sm sm:grid-cols-2">
      <label>
        שם מלא <Req />
        <input name="fullName" defaultValue={c.fullName} required minLength={2} className={field} />
      </label>
      <label>
        טלפון <Req />
        <input name="phone" type="tel" defaultValue={c.phone} required dir="ltr" className={`${field} text-end`} />
      </label>
      <label>
        אימייל
        <input name="email" type="email" defaultValue={c.email ?? ""} dir="ltr" className={`${field} text-end`} />
      </label>
      <label>
        תאריך לידה
        <input name="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={field} />
      </label>
      {birthDate ? (
        <p className="self-end pb-2.5 text-sm text-slate-500">גיל: {calcAge(new Date(birthDate))} (מחושב מתאריך הלידה)</p>
      ) : (
        <label>
          גיל
          <input name="age" type="number" min={1} max={119} defaultValue={c.age ?? ""} className={field} />
        </label>
      )}
      <label>
        ת.ז
        <input name="idNumber" defaultValue={c.idNumber ?? ""} dir="ltr" className={`${field} text-end`} />
      </label>
      <label>
        עיר
        <select name="cityId" defaultValue={c.cityId ?? ""} className={field}>
          <option value="">— בחר עיר —</option>
          {cities.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label>
        מקור
        <select name="sourceId" defaultValue={c.sourceId ?? ""} className={field}>
          <option value="">— בחר מקור —</option>
          {sources.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="sm:col-span-2">
        ניסיון קודם
        <textarea name="previousExperience" defaultValue={c.previousExperience ?? ""} rows={2} className={field} />
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="mb-1">שפות</legend>
        <div className="flex flex-wrap gap-2">
          {languages.map((l) => (
            <label key={l.id} className="cursor-pointer">
              <input type="checkbox" name="languages" value={l.id} defaultChecked={c.languageIds.includes(l.id)} className="peer sr-only" />
              <span className="block rounded-full border border-slate-200 bg-white px-3 py-1 peer-checked:border-transparent peer-checked:bg-emerald-500 peer-checked:text-white peer-focus-visible:ring-2">
                {l.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="sm:col-span-2">
        תקציר על המועמד <span className="text-xs text-slate-400">(גלוי לעסקים)</span>
        <textarea name="summary" defaultValue={c.summary ?? ""} rows={3} className={field} />
      </label>

      <label className="flex items-center justify-between rounded-xl bg-white/60 p-3 sm:col-span-2">
        מאשר/ת קבלת הודעות תפוצה (SMS)
        <input type="checkbox" name="marketingConsent" defaultChecked={c.marketingConsent} className="size-5 accent-emerald-500" />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="bg-accent-gradient rounded-xl px-6 py-2.5 font-medium text-white disabled:opacity-50">
          {pending ? "שומר…" : "שמירה"}
        </button>
        {state?.error && <span className="text-red-600">{state.error}</span>}
        {state?.ok && !pending && <span className="text-emerald-600">נשמר</span>}
      </div>
    </form>
  );
}

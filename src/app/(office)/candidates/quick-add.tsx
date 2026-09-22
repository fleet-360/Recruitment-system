"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { keepValues } from "@/lib/keep-values";
import { UserPlus, X } from "lucide-react";
import type { Option } from "@/lib/lookups";
import { createCandidate, findByPhone } from "./actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-3";

// S-03: 4 fields, Enter saves, duplicate warning while typing the phone.
export function QuickAdd({ sources, defaultOpen }: { sources: Option[]; defaultOpen: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(createCandidate, null);
  const [dup, setDup] = useState<{ id: string; fullName: string } | null>(null);

  useEffect(() => {
    if (defaultOpen) dialog.current?.showModal();
  }, [defaultOpen]);

  async function checkPhone(value: string) {
    setDup(value.replace(/\D/g, "").length >= 9 ? await findByPhone(value) : null);
  }

  const existingId = dup?.id ?? state?.existingId;

  return (
    <>
      <button
        onClick={() => dialog.current?.showModal()}
        className="bg-accent-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-white"
      >
        <UserPlus size={18} /> קליטה מהירה
      </button>

      <dialog ref={dialog} className="glass m-auto w-[min(28rem,calc(100%-2rem))] p-6 backdrop:bg-slate-900/30">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">קליטת מועמד חדש</h2>
          <button onClick={() => dialog.current?.close()} aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={keepValues(action)} className="space-y-3">
          <label className="block text-sm">
            שם מלא <span className="text-red-500">*</span>
            <input name="fullName" required minLength={2} autoFocus className={field} />
          </label>
          <label className="block text-sm">
            טלפון <span className="text-red-500">*</span>
            <input
              name="phone"
              type="tel"
              required
              dir="ltr"
              className={`${field} text-end`}
              onChange={(e) => checkPhone(e.target.value)}
            />
          </label>
          {existingId && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              {dup ? `${dup.fullName} כבר קיים/ת עם הטלפון הזה` : state?.error} —{" "}
              <Link href={`/candidates/${existingId}`} className="font-bold underline">
                פתח כרטיס
              </Link>
            </p>
          )}
          <label className="block text-sm">
            מקור
            <select name="sourceId" className={field} defaultValue="">
              <option value="">— בחר מקור —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            הערה
            <textarea name="note" rows={2} className={field} />
          </label>
          {state?.error && !state.existingId && <p className="text-sm text-red-600">{state.error}</p>}
          <button disabled={pending || !!dup} className="bg-accent-gradient w-full rounded-xl p-3 font-medium text-white disabled:opacity-50">
            {pending ? "שומר…" : "שמירה"}
          </button>
        </form>
      </dialog>
    </>
  );
}

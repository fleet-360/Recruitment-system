"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { Ban, FileUp, RotateCcw, UserPlus } from "lucide-react";
import { keepValues } from "@/lib/keep-values";
import { importLeads, updateLeads } from "./actions";

export type LeadItem = {
  id: string;
  receivedAt: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  campaign: string | null;
  answers: [string, string][];
  candidate: { id: string; fullName: string } | null; // converted to, or (new tab) already exists with this phone
};

export function ImportForm() {
  const [state, action, pending] = useActionState(importLeads, null);

  return (
    <form key={state?.savedAt} onSubmit={keepValues(action)} className="glass flex flex-wrap items-center gap-3 p-4">
      <input
        type="file"
        name="file"
        required
        accept=".xlsx,.csv,.tsv,.txt"
        aria-label="קובץ לידים"
        className="flex-1 basis-60 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-violet-700"
      />
      <button disabled={pending} className="bg-primary-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        <FileUp size={16} /> {pending ? "קולט..." : "ייבוא לידים"}
      </button>
      {state?.error && <p className="basis-full text-sm text-red-600">{state.error}</p>}
      {state?.notice && <p className="basis-full text-sm text-emerald-700">{state.notice}</p>}
    </form>
  );
}

export function LeadsTable({ tab, leads }: { tab: string; leads: LeadItem[] }) {
  const [state, action, pending] = useActionState(updateLeads, null);
  const selectable = tab !== "converted";

  return (
    <form
      key={state?.savedAt} // clears the checkboxes after an action
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        const n = data.getAll("id").length;
        if (data.get("op") === "convert" && n && !confirm(`להמיר ${n} לידים למועמדים?`)) return;
        startTransition(() => action(data));
      }}
      className="glass overflow-hidden"
    >
      {selectable && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 p-3">
          {tab === "new" ? (
            <>
              <button name="op" value="convert" disabled={pending} className="bg-primary-gradient flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-60">
                <UserPlus size={16} /> המרה למועמדים
              </button>
              <button name="op" value="dismiss" disabled={pending} className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-600 hover:bg-white disabled:opacity-60">
                <Ban size={16} /> לא רלוונטי
              </button>
            </>
          ) : (
            <button name="op" value="restore" disabled={pending} className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-600 hover:bg-white disabled:opacity-60">
              <RotateCcw size={16} /> החזרה לחדשים
            </button>
          )}
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state?.notice && <p className="text-sm text-emerald-700">{state.notice}</p>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-slate-200/70 text-xs text-slate-500">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="בחירת הכל"
                    onChange={(e) => e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="id"]').forEach((c) => (c.checked = e.currentTarget.checked))}
                  />
                </th>
              )}
              {["התקבל", "שם", "טלפון", "אימייל", "קמפיין", "תשובות", "מועמד"].map((h) => (
                <th key={h} className="px-3 py-3 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top last:border-0">
                {selectable && (
                  <td className="px-3 py-2.5">
                    <input type="checkbox" name="id" value={l.id} aria-label={`בחירת ${l.fullName ?? "ליד"}`} />
                  </td>
                )}
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{l.receivedAt}</td>
                <td className="px-3 py-2.5 font-medium">{l.fullName ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" dir="ltr">{l.phone ?? "—"}</td>
                <td className="px-3 py-2.5">{l.email ?? "—"}</td>
                <td className="px-3 py-2.5">{l.campaign ?? "—"}</td>
                <td className="px-3 py-2.5">
                  {l.answers.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-slate-500">{l.answers.length} תשובות</summary>
                      <dl className="mt-1 space-y-1">
                        {l.answers.map(([q, a]) => (
                          <div key={q}>
                            <dt className="text-xs text-slate-500">{q}</dt>
                            <dd className="whitespace-pre-wrap">{a}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {l.candidate && (
                    <Link
                      href={`/candidates/${l.candidate.id}`}
                      className={tab === "converted" ? "text-violet-700 hover:underline" : "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 hover:underline"}
                    >
                      {tab === "converted" ? l.candidate.fullName : `מועמד קיים: ${l.candidate.fullName}`}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

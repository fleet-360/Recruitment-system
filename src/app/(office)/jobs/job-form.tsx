"use client";

import { useActionState } from "react";
import { keepValues } from "@/lib/keep-values";
import { createJob, updateJob } from "./actions";

const field = "w-full rounded-xl border border-slate-200 bg-white p-2.5";
const Req = () => <span className="text-red-500">*</span>;

export type BranchGroup = { companyId: string; company: string; branches: { id: string; label: string }[] };
type Job = { id: string; title: string; branchId: string; description: string | null; salary: number | null; openings: number };

// Opens a job (job = null) or edits one. Branches are grouped by company; the server derives the company from the branch.
export function JobForm({ job, groups, defaultBranchId }: { job: Job | null; groups: BranchGroup[]; defaultBranchId?: string }) {
  const [state, action, pending] = useActionState(job ? updateJob.bind(null, job.id) : createJob, null);
  const single = groups.length === 1;

  return (
    <form onSubmit={keepValues(action)} className="grid gap-3 text-sm sm:grid-cols-2">
      <label>
        שם המשרה <Req />
        <input name="title" defaultValue={job?.title} required minLength={2} className={field} />
      </label>
      <label>
        סניף <Req />
        <select name="branchId" defaultValue={job?.branchId ?? defaultBranchId ?? ""} required className={field}>
          <option value="">— בחר סניף —</option>
          {single
            ? groups[0].branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)
            : groups.map((g) => (
                <optgroup key={g.companyId} label={g.company}>
                  {g.branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </optgroup>
              ))}
        </select>
      </label>
      <label>
        שכר חודשי (₪)
        <input name="salary" type="number" min="1" step="1" defaultValue={job?.salary ?? ""} className={field} />
      </label>
      <label>
        מספר תקנים <Req />
        <input name="openings" type="number" min="1" step="1" required defaultValue={job?.openings ?? 1} className={field} />
      </label>
      <label className="sm:col-span-2">
        תיאור ודרישות
        <textarea name="description" defaultValue={job?.description ?? ""} rows={3} className={field} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="bg-accent-gradient rounded-xl px-6 py-2.5 font-medium text-white disabled:opacity-50">
          {pending ? "שומר…" : job ? "שמירה" : "פתיחת משרה"}
        </button>
        {state?.error && <span className="text-red-600">{state.error}</span>}
        {state?.ok && !pending && <span className="text-emerald-600">נשמר</span>}
      </div>
    </form>
  );
}

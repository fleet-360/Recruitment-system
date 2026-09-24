import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";

const actions: Record<string, { label: string; cls: string }> = {
  login_ok: { label: "כניסה", cls: "bg-emerald-50 text-emerald-700" },
  login_fail: { label: "כניסה נכשלה", cls: "bg-red-50 text-red-600" },
  cv_view: { label: "צפייה בקו״ח", cls: "bg-violet-50 text-violet-700" },
};

// Access log (NFR-02, admin only): sign-ins and CV views.
export default async function AccessLogPage({ searchParams }: PageProps<"/settings/access">) {
  await requireAdmin();
  const sp = await searchParams;
  const action = typeof sp.action === "string" && actions[sp.action] ? sp.action : undefined;

  const rows = await db.accessLog.findMany({
    where: action ? { action } : {},
    orderBy: { createdAt: "desc" },
    take: 300, // ponytail: latest 300 only, add date paging when an audit needs older rows (they stay in the DB)
  });
  const fileIds = rows.flatMap((r) => (r.action === "cv_view" && r.entityId ? [r.entityId] : []));
  const files = new Map(
    (await db.candidateFile.findMany({ where: { id: { in: fileIds } }, select: { id: true, filename: true, candidate: { select: { id: true, fullName: true } } } })).map((f) => [f.id, f]),
  );

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <ShieldCheck size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">הגדרות · יומן גישה</h1>
          <p className="text-sm text-slate-500">כניסות למערכת וצפיות בקורות חיים — {rows.length} אחרונות</p>
        </div>
      </section>

      <AutoFilterForm action="/settings/access" className="glass flex flex-wrap gap-2 p-3">
        <select name="action" defaultValue={action ?? ""} className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm" aria-label="פעולה">
          <option value="">כל הפעולות</option>
          {Object.entries(actions).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
        </select>
        {action && <ClearFiltersButton />}
      </AutoFilterForm>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-slate-200/70 text-xs text-slate-500">
            <tr>
              {["מתי", "פעולה", "משתמש", "פרטים", "IP"].map((h) => <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = actions[r.action] ?? { label: r.action, cls: "bg-slate-100" };
              const f = r.entityId ? files.get(r.entityId) : undefined;
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{r.createdAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${a.cls}`}>{a.label}</span></td>
                  <td className="px-4 py-3" dir="ltr">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {f ? <Link href={`/candidates/${f.candidate.id}`} className="text-violet-700 hover:underline">{f.candidate.fullName} · {f.filename}</Link> : r.action === "cv_view" ? "קובץ שנמחק" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">{r.ip ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

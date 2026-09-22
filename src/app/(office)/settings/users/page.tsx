import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Role, type Prisma } from "@/generated/prisma/client";
import { AutoFilterForm, ClearFiltersButton } from "@/components/auto-filter-form";
import { UserForm } from "./user-form";
import { roleNames } from "./roles";
import { companiesWithBranches } from "./companies";

// S-18 users (admin only): office and business users, role, company, branches.
export default async function UsersPage({ searchParams }: PageProps<"/settings/users">) {
  await requireAdmin();
  const sp = await searchParams;
  const role = Object.values(Role).includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const company = typeof sp.company === "string" && sp.company ? sp.company : undefined;
  const where: Prisma.UserWhereInput = { ...(role && { role }), ...(company && { companyId: company }) };

  const [users, companies] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
      include: { company: { select: { name: true } }, branches: { select: { branch: { select: { name: true } } } } },
    }),
    companiesWithBranches(),
  ]);

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <UserCog size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">הגדרות · משתמשים</h1>
          <p className="text-sm text-slate-500">{users.length} משתמשים</p>
        </div>
      </section>

      <details className="glass p-5" open={sp.new === "1"}>
        <summary className="flex items-center gap-1 font-bold text-violet-700"><Plus size={18} /> משתמש חדש</summary>
        <div className="space-y-3 pt-4">
          <p className="text-sm text-slate-500">המערכת יוצרת סיסמה זמנית — מעבירים אותה למשתמש, והוא בוחר סיסמה חדשה בכניסה הראשונה.</p>
          <UserForm user={null} companies={companies} />
        </div>
      </details>

      <AutoFilterForm action="/settings/users" className="glass flex flex-wrap gap-2 p-3">
        <select name="role" defaultValue={role ?? ""} className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm" aria-label="תפקיד">
          <option value="">כל התפקידים</option>
          {Object.values(Role).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
        </select>
        <select name="company" defaultValue={company ?? ""} className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm" aria-label="חברה">
          <option value="">כל החברות</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(role || company) && <ClearFiltersButton />}
      </AutoFilterForm>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-slate-200/70 text-xs text-slate-500">
            <tr>
              {["שם", "אימייל", "תפקיד", "חברה · סניפים", "סטטוס"].map((h) => <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`relative border-b border-slate-100 last:border-0 hover:bg-white/70 ${u.isActive ? "" : "opacity-60"}`}>
                <td className="px-4 py-3">
                  <Link href={`/settings/users/${u.id}`} className="font-bold after:absolute after:inset-0">{u.name ?? "—"}</Link>
                </td>
                <td className="px-4 py-3" dir="ltr">{u.email}</td>
                <td className="px-4 py-3">{roleNames[u.role]}</td>
                <td className="px-4 py-3">
                  {u.company ? [u.company.name, u.role === "company_admin" ? "כל הסניפים" : u.branches.map((b) => b.branch.name).join(", ")].join(" · ") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${!u.isActive ? "bg-slate-200 text-slate-600" : u.mustChangePassword ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {!u.isActive ? "מושבת" : u.mustChangePassword ? "ממתין לכניסה ראשונה" : "פעיל"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import { Building2, MapPin, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { businessBranchIds } from "@/lib/access";
import { ResetPasswordForm } from "@/app/(office)/settings/users/user-form";
import { resetManagerPassword, toggleManagerActive } from "./actions";
import { ManagerForm } from "./manager-form";

// B-05 company + branches; a company admin also manages the company's branch managers.
export default async function PortalProfile() {
  const user = await requireBusiness();
  const isCompanyAdmin = user.role === "company_admin";
  const [company, branches, users] = await Promise.all([
    user.companyId ? db.company.findUnique({ where: { id: user.companyId }, select: { name: true, regNumber: true } }) : null,
    db.branch.findMany({
      where: { id: { in: await businessBranchIds(user) } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true, city: { select: { label: true } } },
    }),
    isCompanyAdmin && user.companyId
      ? db.user.findMany({
          where: { companyId: user.companyId },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, branches: { select: { branch: { select: { name: true } } } } },
        })
      : [],
  ]);

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white"><Building2 size={24} /></span>
        <div>
          <h1 className="text-2xl font-bold">{company?.name}</h1>
          <p className="text-sm text-slate-500">{[company?.regNumber && `ח.פ. ${company.regNumber}`, `${user.name ?? user.email}`].filter(Boolean).join(" · ")}</p>
        </div>
      </section>

      <section className="glass space-y-2 p-5">
        <h2 className="font-bold">{isCompanyAdmin ? "סניפים" : "הסניפים שלי"}</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center gap-2 py-2">
              <MapPin size={16} className="text-violet-500" />
              <span className="font-medium">{b.name}</span>
              <span className="text-slate-500">{[b.city?.label, b.address].filter(Boolean).join(", ")}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">לשינוי פרטי החברה או הסניפים — פנו למשרד.</p>
      </section>

      {isCompanyAdmin && (
        <section className="glass space-y-4 p-5">
          <h2 className="font-bold">משתמשי העסק</h2>
          <ul className="space-y-2 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{u.name} {u.id === user.id && <span className="text-xs text-slate-400">(את/ה)</span>}</p>
                  <p className="text-xs text-slate-500" dir="ltr">{u.email}</p>
                  <p className="text-xs text-slate-500">
                    {u.role === "company_admin" ? "מנהל/ת חברה" : `מנהל/ת סניף · ${u.branches.map((b) => b.branch.name).join(", ")}`}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${!u.isActive ? "bg-slate-100 text-slate-500" : u.mustChangePassword ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {!u.isActive ? "מושבת" : u.mustChangePassword ? "ממתין לכניסה ראשונה" : "פעיל"}
                </span>
                {u.role === "branch_manager" && (
                  <div className="flex w-full flex-wrap items-start gap-2">
                    <form action={toggleManagerActive.bind(null, u.id)}>
                      <button className="rounded-xl bg-white px-4 py-2.5 text-sm shadow-sm hover:shadow">{u.isActive ? "השבתה" : "הפעלה מחדש"}</button>
                    </form>
                    {u.isActive && <ResetPasswordForm userId={u.id} reset={resetManagerPassword} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <details className="rounded-xl bg-white/60 p-3">
            <summary className="flex items-center gap-1 font-bold text-violet-700"><Plus size={18} /> מנהל/ת סניף חדש/ה</summary>
            <div className="pt-3">
              <ManagerForm branches={branches.map((b) => ({ id: b.id, name: b.name }))} />
              <p className="mt-2 text-xs text-slate-500">תוצג סיסמה זמנית פעם אחת — העבירו אותה למשתמש. בכניסה הראשונה יתבקש/תתבקש להחליף אותה.</p>
            </div>
          </details>
        </section>
      )}
    </>
  );
}

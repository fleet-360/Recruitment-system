import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, UserCog } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ResetPasswordForm, UserForm } from "../user-form";
import { roleNames } from "../roles";
import { companiesWithBranches } from "../companies";

export default async function UserPage({ params }: PageProps<"/settings/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const [u, companies] = await Promise.all([
    db.user.findUnique({ where: { id }, include: { branches: { select: { branchId: true } } } }),
    companiesWithBranches(),
  ]);
  if (!u) notFound();

  return (
    <>
      <Link href="/settings/users" className="flex items-center gap-1 text-sm text-slate-500 hover:underline"><ChevronRight size={16} /> כל המשתמשים</Link>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <UserCog size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{u.name ?? u.email}</h1>
          <p className="text-sm text-slate-500">{roleNames[u.role]} · נוצר {u.createdAt.toLocaleDateString("he-IL")}</p>
        </div>
      </section>

      <section className="glass p-5">
        <UserForm
          user={{ id: u.id, name: u.name, email: u.email, role: u.role, companyId: u.companyId, branchIds: u.branches.map((b) => b.branchId), isActive: u.isActive }}
          companies={companies}
        />
      </section>

      <section className="glass space-y-2 p-5">
        <h2 className="font-bold">סיסמה</h2>
        {u.id === admin.id ? (
          <Link href="/account/password" className="text-sm font-bold text-violet-700 underline">החלפת הסיסמה שלי</Link>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              {u.mustChangePassword ? "המשתמש עוד לא החליף את הסיסמה הזמנית." : "שכח סיסמה? איפוס יוצר סיסמה זמנית חדשה, והמשתמש יחליף אותה בכניסה הבאה."}
            </p>
            <ResetPasswordForm userId={u.id} />
          </>
        )}
      </section>
    </>
  );
}

import Link from "next/link";
import { KeyRound, LogOut, Sparkles } from "lucide-react";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { NavLinks } from "@/components/nav-links";

// Business portal shell: mobile-first, bottom nav on phones (B-01..B-05).
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBusiness();
  const company = user.companyId ? await db.company.findUnique({ where: { id: user.companyId }, select: { name: true } }) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-3 pb-24 md:p-4">
      <header className="glass flex items-center gap-4 px-4 py-3">
        <span className="flex items-center gap-2 font-bold">
          <span className="bg-primary-gradient flex size-8 items-center justify-center rounded-lg text-white">
            <Sparkles size={16} />
          </span>
          {company?.name ?? "פורטל עסקים"}
        </span>
        <nav className="hidden flex-1 md:block">
          <NavLinks variant="top" area="portal" />
        </nav>
        <Link href="/account/password" className="ms-auto text-slate-500 hover:text-violet-700 md:ms-0" title="החלפת סיסמה" aria-label="החלפת סיסמה">
          <KeyRound size={20} />
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="flex items-center text-red-500" title="יציאה" aria-label="יציאה">
            <LogOut size={20} className="-scale-x-100" />
          </button>
        </form>
      </header>

      {children}

      <nav className="glass fixed inset-x-3 bottom-3 p-2 md:hidden">
        <NavLinks variant="bottom" area="portal" />
      </nav>
    </div>
  );
}

import Link from "next/link";
import { KeyRound, LogOut, Sparkles } from "lucide-react";
import { signOut } from "@/auth";
import { requireOffice } from "@/lib/session";
import { NavLinks } from "./nav-links";
import { NotificationBell } from "./bell";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOffice();
  const isAdmin = user.role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-3 pb-24 md:p-4">
      <header className="glass flex items-center gap-4 px-4 py-3">
        <span className="flex items-center gap-2 font-bold">
          <span className="bg-primary-gradient flex size-8 items-center justify-center rounded-lg text-white">
            <Sparkles size={16} />
          </span>
          CRM השמה
        </span>
        <nav className="hidden flex-1 md:block">
          <NavLinks variant="top" isAdmin={isAdmin} />
        </nav>
        <NotificationBell userId={user.id} />
        <Link href="/account/password" className="text-slate-500 hover:text-violet-700" title="החלפת סיסמה" aria-label="החלפת סיסמה">
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
        <NavLinks variant="bottom" isAdmin={isAdmin} />
      </nav>
    </div>
  );
}

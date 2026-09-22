import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getUser, isOffice } from "@/lib/session";
import { PasswordForm } from "./password-form";

// Change password. Users with a temporary password from an admin land here after login and can't leave until they change it.
export default async function PasswordPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="glass w-full max-w-sm space-y-4 p-8">
        <div className="text-center">
          <span className="bg-accent-gradient mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl text-white">
            <KeyRound size={26} />
          </span>
          <h1 className="text-2xl font-bold">החלפת סיסמה</h1>
          <p className="text-sm text-slate-500">
            {user.mustChangePassword ? "קיבלת סיסמה זמנית — יש לבחור סיסמה חדשה כדי להמשיך" : user.email}
          </p>
        </div>
        <PasswordForm />
        {!user.mustChangePassword && (
          <Link href={isOffice(user) ? "/" : "/portal"} className="block text-center text-sm text-slate-500 hover:underline">חזרה</Link>
        )}
      </div>
    </main>
  );
}

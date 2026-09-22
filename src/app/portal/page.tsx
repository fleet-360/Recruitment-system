import { redirect } from "next/navigation";
import { isOffice, requireUser } from "@/lib/session";

// Business portal home (B-01).
export default async function PortalHome() {
  const user = await requireUser();
  if (isOffice(user)) redirect("/");

  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <section className="glass p-6">
        <h1 className="text-2xl font-bold">שלום, {user.name ?? user.email}</h1>
        <p className="text-slate-500">פורטל העסקים ייבנה בשלב הבא</p>
      </section>
    </main>
  );
}

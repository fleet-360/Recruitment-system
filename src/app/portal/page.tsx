import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Business portal home (B-01).
export default async function PortalHome() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!session.user.companyId) redirect("/");

  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <section className="glass p-6">
        <h1 className="text-2xl font-bold">שלום, {session.user.name ?? session.user.email}</h1>
        <p className="text-slate-500">פורטל העסקים ייבנה בשלב הבא</p>
      </section>
    </main>
  );
}

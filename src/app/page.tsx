import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

// Office home (S-02). Business users go to their portal.
export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.companyId) redirect("/portal");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <header className="glass flex items-center justify-between p-4">
        <span className="font-bold">CRM השמה</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="text-sm text-red-500">יציאה</button>
        </form>
      </header>
      <section className="glass p-6">
        <h1 className="text-2xl font-bold">שלום, {session.user.name ?? session.user.email}</h1>
        <p className="text-slate-500">הדשבורד ייבנה בשלב הבא</p>
      </section>
    </main>
  );
}

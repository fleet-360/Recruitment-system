import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireOffice } from "@/lib/session";

// Office home (S-02). KPIs and tasks come in a later step.
export default async function Home() {
  const user = await requireOffice();

  return (
    <>
      <section className="glass p-6">
        <h1 className="text-2xl font-bold">שלום, {user.name ?? user.email}</h1>
        <p className="text-slate-500">מעקב אחרי המועמדים וההשמות</p>
      </section>
      <Link href="/candidates?new=1" className="glass flex flex-col items-center gap-2 p-8 text-center hover:shadow-lg">
        <UserPlus size={40} className="text-emerald-500" />
        <span className="text-lg font-bold">קליטת מועמד חדש</span>
        <span className="text-sm text-slate-500">שם, טלפון ומקור — פחות מ-30 שניות</span>
      </Link>
    </>
  );
}

import Link from "next/link";
import { BriefcaseBusiness, CircleCheck, Hourglass, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { myPlacements, processSteps, stageOf } from "./data";

// B-01 business home: greeting, KPIs, "open a job".
export default async function PortalHome() {
  const user = await requireBusiness();
  const [company, placements, steps] = await Promise.all([
    user.companyId ? db.company.findUnique({ where: { id: user.companyId }, select: { name: true } }) : null,
    myPlacements(user),
    processSteps(),
  ]);
  const hiredId = steps.at(-1)?.id;
  const stages = placements.map((p) => stageOf(p, hiredId));
  const kpis = [
    { label: "סך מועמדים", value: new Set(placements.map((p) => p.candidate.id)).size, Icon: Users, tone: "bg-accent-gradient" },
    { label: "בתהליך", value: stages.filter((s) => s === "active").length, Icon: Hourglass, tone: "bg-primary-gradient" },
    { label: "התקבלו", value: stages.filter((s) => s === "hired").length, Icon: CircleCheck, tone: "bg-emerald-500" },
  ];

  return (
    <>
      <section className="glass p-6">
        <h1 className="text-2xl font-bold">שלום, {company?.name ?? user.name}</h1>
        <p className="text-slate-500">{user.name} · המועמדים והמשרות של הסניפים שלך</p>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        {kpis.map(({ label, value, Icon, tone }) => (
          <Link key={label} href="/portal/candidates" className="glass flex flex-col gap-2 p-3 hover:shadow-lg sm:p-5">
            <span className={`${tone} flex size-9 items-center justify-center rounded-xl text-white`}><Icon size={18} /></span>
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-3xl font-bold">{value}</span>
          </Link>
        ))}
      </section>

      <Link href="/portal/jobs?new=1" className="glass flex flex-col items-center gap-2 p-8 text-center hover:shadow-lg">
        <BriefcaseBusiness size={40} className="text-violet-500" />
        <span className="text-lg font-bold">פתיחת משרה</span>
        <span className="text-sm text-slate-500">המשרה נפתחת מיד והמשרד מקבל התראה</span>
      </Link>
    </>
  );
}

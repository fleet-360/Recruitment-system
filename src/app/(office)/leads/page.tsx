import Link from "next/link";
import { Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { israelDateTime } from "@/lib/fees";
import { leadAnswers } from "@/lib/leads";
import type { Prisma } from "@/generated/prisma/client";
import { ImportForm, LeadsTable, type LeadItem } from "./leads-client";

const tabs = [
  { id: "new", label: "חדשים", where: { candidateId: null, dismissedAt: null } },
  { id: "converted", label: "הומרו", where: { candidateId: { not: null } } },
  { id: "dismissed", label: "לא רלוונטי", where: { candidateId: null, dismissedAt: { not: null } } },
] satisfies { id: string; label: string; where: Prisma.LeadWhereInput }[];

// S-06 Meta leads inbox (REQ-14): import the Ads Manager export, then convert to candidates or dismiss.
export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  await requireOffice();
  const sp = await searchParams;
  const tab = tabs.find((t) => t.id === sp.tab) ?? tabs[0];

  const [counts, leads] = await Promise.all([
    Promise.all(tabs.map((t) => db.lead.count({ where: t.where }))),
    // ponytail: newest 300 per tab, no paging — add paging if an inbox tab ever holds more
    db.lead.findMany({ where: tab.where, orderBy: { receivedAt: "desc" }, take: 300, include: { candidate: { select: { id: true, fullName: true } } } }),
  ]);
  // duplicate marking: a new lead whose phone is already a candidate will be linked, not duplicated
  const phones = leads.flatMap((l) => (l.phone && !l.candidate ? [l.phone] : []));
  const existing = new Map(
    (await db.candidate.findMany({ where: { phone: { in: phones } }, select: { id: true, fullName: true, phone: true } })).map((c) => [c.phone, c]),
  );

  const items: LeadItem[] = leads.map((l) => ({
    id: l.id,
    receivedAt: israelDateTime(l.receivedAt),
    fullName: l.fullName,
    phone: l.phone,
    email: l.email,
    campaign: l.campaign,
    answers: leadAnswers(l.raw as Record<string, string>),
    candidate: l.candidate ?? (l.phone ? existing.get(l.phone) : undefined) ?? null,
  }));

  return (
    <>
      <section className="glass flex flex-wrap items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <Inbox size={24} />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">לידים ממטא</h1>
          <p className="text-sm text-slate-500">מורידים את קובץ הלידים ממנהל המודעות ומעלים אותו כאן</p>
        </div>
      </section>

      <ImportForm />

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t, i) => (
          <Link
            key={t.id}
            href={i ? `/leads?tab=${t.id}` : "/leads"}
            replace
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm ${t === tab ? "bg-accent-gradient text-white" : "glass text-slate-600"}`}
          >
            {t.label}
            <span className={`rounded-full px-2 text-xs ${t === tab ? "bg-white/25" : "bg-slate-100"}`}>{counts[i]}</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <section className="glass flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Inbox size={26} />
          </span>
          <h2 className="font-bold">אין לידים</h2>
          <p className="text-sm text-slate-500">{tab.id === "new" ? "העלו קובץ לידים ממטא כדי להתחיל" : "אין לידים בטאב הזה"}</p>
        </section>
      ) : (
        <LeadsTable key={tab.id} tab={tab.id} leads={items} />
      )}
    </>
  );
}

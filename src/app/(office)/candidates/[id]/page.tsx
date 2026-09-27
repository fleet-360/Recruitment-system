import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, Briefcase, CalendarDays, Coins, FileText, MessageCircle, MessageSquare, Phone, StickyNote } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { candidateWhere } from "@/lib/access";
import { getList, withCurrent } from "@/lib/lookups";
import { toIntl } from "@/lib/phone";
import { StatusStepper } from "@/components/status-stepper";
import { addNote, setCandidateStatus } from "../actions";
import { DetailsForm } from "./details-form";
import { FileUpload } from "./file-upload";
import { DeleteFileButton } from "./delete-file-button";
import { AnonymizeButton } from "./anonymize-button";
import { PlacementDrawer } from "../../placements/drawer";
import { TaskItems, officeUsers, taskInclude } from "../../tasks/data";
import { TaskForm } from "../../tasks/task-form";
import { israelDateTime, today, toIsraelLocal } from "@/lib/fees";
import { CancelInterviewButton, InterviewForm } from "../../interviews/interview-form";
import { dayKey } from "@/lib/month";

const when = (d: Date) => d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

// S-05 candidate card
export default async function CandidatePage({ params, searchParams }: PageProps<"/candidates/[id]">) {
  const user = await requireOffice();
  const { id } = await params;
  const openId = (await searchParams).p;

  const candidate = await db.candidate.findFirst({
    where: { AND: [{ id }, await candidateWhere(user)] },
    include: {
      city: { select: { id: true, label: true } },
      status: { select: { id: true, label: true } },
      source: { select: { id: true, label: true } },
      languages: { select: { language: { select: { id: true, label: true } } } },
      files: { orderBy: { uploadedAt: "desc" } },
      placements: {
        orderBy: { createdAt: "desc" },
        include: { status: { select: { label: true, systemKey: true } }, job: { select: { title: true, company: { select: { name: true } }, branch: { select: { name: true } } } } },
      },
      tasks: { where: { doneAt: null }, orderBy: { dueAt: "asc" }, include: taskInclude },
      interviews: { orderBy: { scheduledAt: "desc" }, take: 10, include: { placement: { select: { job: { select: { title: true } } } } } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } }, placement: { select: { job: { select: { title: true } } } } },
      },
    },
  });
  if (!candidate) notFound();

  const [statuses, cities, sources, languages, users] = await Promise.all([
    getList("candidate_status").then((l) => withCurrent(l, candidate.status)),
    getList("city").then((l) => withCurrent(l, candidate.city)),
    getList("lead_source").then((l) => withCurrent(l, candidate.source)),
    getList("language").then((l) => withCurrent(l, ...candidate.languages.map((x) => x.language))),
    officeUsers(),
  ]);

  return (
    <>
      <section className="glass space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-primary-gradient flex size-14 items-center justify-center rounded-full text-xl font-bold text-white">
            {candidate.fullName[0]}
          </span>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{candidate.fullName}</h1>
            <p className="text-sm text-slate-500">
              {[candidate.city?.label, ...candidate.languages.map((l) => l.language.label)].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          {candidate.anonymizedAt ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">הנתונים האישיים נמחקו ב-{candidate.anonymizedAt.toLocaleDateString("he-IL")}</span>
          ) : (
            <>
              <a href={`tel:${candidate.phone}`} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm shadow-sm" dir="ltr">
                <Phone size={16} /> {candidate.phone}
              </a>
              <a
                href={`https://wa.me/${toIntl(candidate.phone)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm text-white"
              >
                <MessageCircle size={16} /> וואטסאפ
              </a>
              {user.role === "admin" && <AnonymizeButton id={id} name={candidate.fullName} />}
            </>
          )}
        </div>
        <StatusStepper steps={statuses} currentId={candidate.statusId} action={setCandidateStatus.bind(null, id)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="glass p-5 lg:col-span-3">
          <h2 className="mb-4 font-bold">פרטים</h2>
          {candidate.anonymizedAt ? <p className="text-sm text-slate-500">הפרטים נמחקו לבקשת המועמד. ההשמות והגבייה נשמרו ללא פרטים מזהים.</p> : <DetailsForm
            candidate={{
              id,
              fullName: candidate.fullName,
              phone: candidate.phone,
              email: candidate.email,
              birthDate: candidate.birthDate?.toISOString().slice(0, 10) ?? null,
              cityId: candidate.cityId,
              sourceId: candidate.sourceId,
              summary: candidate.summary,
              marketingConsent: candidate.marketingConsent,
              languageIds: candidate.languages.map((l) => l.language.id),
            }}
            cities={cities}
            sources={sources}
            languages={languages}
          />}
        </section>

        <div className="space-y-4 lg:col-span-2">
          <section className="glass space-y-3 p-5">
            <h2 className="font-bold">השמות</h2>
            <ul className="space-y-1 text-sm">
              {candidate.placements.map((p) => (
                <li key={p.id}>
                  <Link href={`/candidates/${id}?p=${p.id}`} scroll={false} className="flex items-center gap-2 rounded-lg p-2 hover:bg-white/60">
                    <Briefcase size={16} className="shrink-0 text-violet-500" />
                    <span className="flex-1">
                      <span className="font-bold">{p.job.title}</span> <span className="text-slate-500">· {p.job.company.name} · {p.job.branch.name}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${p.status?.systemKey ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-700"}`}>{p.status?.label}</span>
                  </Link>
                </li>
              ))}
              {candidate.placements.length === 0 && <li className="text-slate-400">עדיין לא שויך למשרה — השיוך נעשה מדף המשרה</li>}
            </ul>
          </section>

          <section className="glass space-y-3 p-5">
            <h2 className="font-bold">ראיונות</h2>
            <InterviewForm
              candidateId={id}
              placements={candidate.placements.filter((p) => !p.status?.systemKey).map((p) => ({ id: p.id, label: `${p.job.title} · ${p.job.company.name}` }))}
              min={toIsraelLocal(new Date())}
            />
            <ul className="space-y-1 text-sm">
              {candidate.interviews.map((i) => {
                const past = i.scheduledAt < new Date();
                return (
                  <li key={i.id} className={`flex items-center gap-2 rounded-xl p-2 ${past ? "text-slate-400" : "bg-white/60"}`}>
                    <CalendarDays size={16} className={`shrink-0 ${past ? "" : "text-violet-500"}`} />
                    <span className="flex-1">
                      <span className="font-medium">{israelDateTime(i.scheduledAt)}</span>
                      {(i.placement || i.location) && <span className="block text-xs">{[i.placement?.job.title, i.location].filter(Boolean).join(" · ")}</span>}
                    </span>
                    {!past && <CancelInterviewButton id={i.id} />}
                  </li>
                );
              })}
              {candidate.interviews.length === 0 && <li className="text-slate-400">לא נקבעו ראיונות</li>}
            </ul>
          </section>

          <section className="glass space-y-3 p-5">
            <h2 className="font-bold">משימות פתוחות</h2>
            <TaskForm candidateId={id} users={users} meId={user.id} today={dayKey(today())} />
            {candidate.tasks.length ? <TaskItems tasks={candidate.tasks} now={today()} showCandidate={false} /> : <p className="text-sm text-slate-400">אין משימות פתוחות</p>}
          </section>

          <section className="glass space-y-3 p-5">
            <h2 className="font-bold">קבצים</h2>
            <FileUpload candidateId={id} />
            <ul className="space-y-1 text-sm">
              {candidate.files.map((f) => (
                <li key={f.id} className="flex items-center">
                  <a href={`/api/files/${f.id}`} target="_blank" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 hover:bg-white/60">
                    <FileText size={16} className="text-violet-500" />
                    <span className="flex-1 truncate">{f.filename}</span>
                    <span className="text-xs text-slate-400">{when(f.uploadedAt)}</span>
                  </a>
                  <DeleteFileButton fileId={f.id} filename={f.filename} />
                </li>
              ))}
            </ul>
          </section>

          <section className="glass space-y-3 p-5">
            <h2 className="font-bold">הערות והיסטוריה</h2>
            <form action={addNote.bind(null, id)} className="space-y-2">
              <textarea name="body" required rows={2} placeholder="הוספת הערה (פנימית — לא נחשפת לעסקים)" className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm" />
              <button className="bg-primary-gradient rounded-xl px-4 py-2 text-sm font-medium text-white">הוספה</button>
            </form>
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {candidate.activities.map((a) => (
                <li key={a.id} className="flex gap-2 rounded-xl bg-white/60 p-3">
                  {a.type === "status_change" ? <ArrowLeftRight size={16} className="mt-0.5 shrink-0 text-violet-500" /> : a.type === "billing" ? <Coins size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : a.type === "sms" ? <MessageSquare size={16} className="mt-0.5 shrink-0 text-sky-500" /> : <StickyNote size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap">
                      {a.placement && <span className="font-medium text-violet-700">{a.placement.job.title}: </span>}
                      {a.type === "status_change" ? `סטטוס: ${a.fromValue ?? "—"} ← ${a.toValue}${a.body ? ` (${a.body})` : ""}` : a.body}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.user?.name ?? a.user?.email ?? "מערכת"} · {when(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
              {candidate.activities.length === 0 && <li className="text-slate-400">אין עדיין הערות</li>}
            </ul>
          </section>
        </div>
      </div>

      {typeof openId === "string" && <PlacementDrawer placementId={openId} closeHref={`/candidates/${id}`} />}
    </>
  );
}

import { notFound } from "next/navigation";
import { ArrowLeftRight, FileText, MessageCircle, Phone, StickyNote } from "lucide-react";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { candidateWhere } from "@/lib/access";
import { getList } from "@/lib/lookups";
import { toIntl } from "@/lib/phone";
import { StatusStepper } from "@/components/status-stepper";
import { addNote, setCandidateStatus } from "../actions";
import { DetailsForm } from "./details-form";
import { FileUpload } from "./file-upload";
import { DeleteFileButton } from "./delete-file-button";

const when = (d: Date) => d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

// S-05 candidate card
export default async function CandidatePage({ params }: PageProps<"/candidates/[id]">) {
  const user = await requireOffice();
  const { id } = await params;

  const candidate = await db.candidate.findFirst({
    where: { AND: [{ id }, await candidateWhere(user)] },
    include: {
      city: { select: { label: true } },
      languages: { select: { language: { select: { id: true, label: true } } } },
      files: { orderBy: { uploadedAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!candidate) notFound();

  const [statuses, cities, sources, languages] = await Promise.all([
    getList("candidate_status"),
    getList("city"),
    getList("lead_source"),
    getList("language"),
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
        </div>
        <StatusStepper steps={statuses} currentId={candidate.statusId} action={setCandidateStatus.bind(null, id)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="glass p-5 lg:col-span-3">
          <h2 className="mb-4 font-bold">פרטים</h2>
          <DetailsForm
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
          />
        </section>

        <div className="space-y-4 lg:col-span-2">
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
                  {a.type === "status_change" ? <ArrowLeftRight size={16} className="mt-0.5 shrink-0 text-violet-500" /> : <StickyNote size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap">
                      {a.type === "status_change" ? `סטטוס: ${a.fromValue ?? "—"} ← ${a.toValue}` : a.body}
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
    </>
  );
}

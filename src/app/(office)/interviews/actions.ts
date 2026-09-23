"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { candidateWhere } from "@/lib/access";
import { fromIsraelLocal, israelDateTime } from "@/lib/fees";

export type InterviewState = { error?: string; savedAt?: number } | null;

const label = (at: Date, location: string | null) =>
  `${israelDateTime(at)}${location ? ` · ${location}` : ""}`;

function refresh(candidateId: string) {
  revalidatePath("/");
  revalidatePath("/interviews");
  revalidatePath(`/candidates/${candidateId}`);
}

const schema = z.object({
  scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "יש לבחור תאריך ושעה").transform(fromIsraelLocal),
  placementId: z.string().optional().transform((v) => v || null),
  location: z.string().trim().max(200, "עד 200 תווים").optional().transform((v) => v || null),
});

// S-12: schedule an interview from the candidate card. Moves a candidate who is at an earlier stage to "נקבע ראיון"
// (decided 23/09/2026) — never backwards. Office only; Google Calendar invites come with task 25.
export async function createInterview(candidateId: string, _: InterviewState, formData: FormData): Promise<InterviewState> {
  const user = await requireOffice();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { scheduledAt, placementId, location } = parsed.data;
  if (scheduledAt < new Date()) return { error: "המועד כבר עבר" };

  const candidate = await db.candidate.findFirst({ where: { AND: [{ id: candidateId }, await candidateWhere(user)] }, include: { status: true } });
  if (!candidate) return { error: "המועמד לא נמצא" };
  if (placementId && !(await db.placement.findFirst({ where: { id: placementId, candidateId }, select: { id: true } }))) return { error: "ההשמה לא נמצאה" };
  const target = await db.lookupValue.findUnique({ where: { listKey_systemKey: { listKey: "candidate_status", systemKey: "interview" } } });
  const moveStatus = target && (!candidate.status || candidate.status.sortOrder < target.sortOrder);

  await db.$transaction([
    db.interview.create({ data: { candidateId, placementId, scheduledAt, location } }),
    db.activity.create({ data: { candidateId, placementId, userId: user.id, type: "note", body: `נקבע ראיון: ${label(scheduledAt, location)}` } }),
    ...(moveStatus
      ? [
          db.candidate.update({ where: { id: candidateId }, data: { statusId: target.id } }),
          db.activity.create({ data: { candidateId, userId: user.id, type: "status_change", fromValue: candidate.status?.label ?? null, toValue: target.label } }),
        ]
      : []),
  ]);
  refresh(candidateId);
  return { savedAt: Date.now() };
}

// Cancel = delete, with a line in the candidate's history. The candidate's status stays as it is.
export async function cancelInterview(id: string) {
  const user = await requireOffice();
  const i = await db.interview.findUnique({ where: { id } });
  if (!i) return;
  await db.$transaction([
    db.interview.delete({ where: { id } }),
    db.activity.create({ data: { candidateId: i.candidateId, placementId: i.placementId, userId: user.id, type: "note", body: `ראיון בוטל: ${label(i.scheduledAt, i.location)}` } }),
  ]);
  refresh(i.candidateId);
}

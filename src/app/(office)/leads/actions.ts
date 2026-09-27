"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { normalizePhone } from "@/lib/phone";
import { today } from "@/lib/fees";
import { leadAnswers, parseLeads, readSheet } from "@/lib/leads";
import { Prisma } from "@/generated/prisma/client";

export type LeadState = { error?: string; notice?: string; savedAt?: number } | null;

const MAX_BYTES = 5 * 1024 * 1024;

// Upload a Meta export → new Lead rows. Leads already imported (same Meta id) are skipped, so re-uploading
// an overlapping export is safe.
export async function importLeads(_: LeadState, formData: FormData): Promise<LeadState> {
  await requireOffice();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "יש לבחור קובץ" };
  if (file.size > MAX_BYTES) return { error: "הקובץ גדול מדי (עד 5MB)" };

  let leads;
  try {
    leads = parseLeads(readSheet(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    return { error: e instanceof Error && /[א-ת]/.test(e.message) ? e.message : "לא הצלחנו לקרוא את הקובץ — יש להעלות xlsx או CSV" };
  }
  if (!leads) return { error: "לא נמצאה עמודת id — יש להעלות את קובץ הלידים כפי שהורד ממטא" };

  const { count } = await db.lead.createMany({ data: leads, skipDuplicates: true });
  revalidatePath("/leads");
  const skipped = leads.length - count;
  return { notice: `נקלטו ${count} לידים חדשים${skipped ? ` · ${skipped} כבר היו במערכת` : ""}`, savedAt: Date.now() };
}

// Bulk actions from the inbox: convert to candidates, dismiss ("not relevant") or restore.
export async function updateLeads(_: LeadState, formData: FormData): Promise<LeadState> {
  const user = await requireOffice();
  const ids = formData.getAll("id").map(String);
  const op = formData.get("op");
  if (!ids.length) return { error: "לא נבחרו לידים" };

  if (op === "dismiss" || op === "restore") {
    await db.lead.updateMany({ where: { id: { in: ids }, candidateId: null }, data: { dismissedAt: op === "dismiss" ? new Date() : null } });
    revalidatePath("/leads");
    return { savedAt: Date.now() };
  }
  if (op !== "convert") throw new Error("invalid op");

  const [leads, source, firstStatus] = await Promise.all([
    db.lead.findMany({ where: { id: { in: ids }, candidateId: null, dismissedAt: null }, orderBy: { receivedAt: "asc" } }),
    db.lookupValue.findUnique({ where: { listKey_systemKey: { listKey: "lead_source", systemKey: "meta" } } }),
    db.lookupValue.findFirst({ where: { listKey: "candidate_status", isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  let created = 0, linked = 0, badPhone = 0;
  for (const lead of leads) {
    const phone = normalizePhone(lead.phone ?? "");
    if (!phone) {
      badPhone++;
      continue;
    }
    // The form answers go into the candidate's history so nothing from the lead is lost.
    const body = [`ליד ממטא${lead.campaign ? ` · ${lead.campaign}` : ""}`, ...leadAnswers(lead.raw as Record<string, string>).map(([q, a]) => `${q}: ${a}`)].join("\n");
    const link = { leads: { connect: { id: lead.id } }, activities: { create: { type: "note" as const, body, userId: user.id } } };

    const existing = await db.candidate.findUnique({ where: { phone }, select: { id: true } });
    if (!existing) {
      try {
        await db.candidate.create({
          data: {
            fullName: lead.fullName ?? "ליד ללא שם",
            phone,
            email: lead.email,
            sourceId: source?.id,
            statusId: firstStatus?.id,
            ownerUserId: user.id,
            tasks: { create: { title: "פולואפ ראשוני", dueAt: today(), assignedToId: user.id } },
            ...link,
          },
        });
        created++;
        continue;
      } catch (e) {
        // someone created this phone a moment ago — fall through and link to it
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
    await db.candidate.update({ where: { phone }, data: link });
    linked++;
  }

  revalidatePath("/leads");
  revalidatePath("/candidates");
  const parts = [
    created && `נוצרו ${created} מועמדים`,
    linked && `${linked} שויכו למועמדים קיימים (לפי טלפון)`,
    badPhone && `${badPhone} בלי טלפון תקין — נשארו בתיבה`,
  ].filter(Boolean);
  return { notice: parts.join(" · ") || "לא הומרו לידים", savedAt: Date.now() };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { newOptOutToken, sendSms, smsConfigured, withOptOut } from "@/lib/sms";
import { resolveSegment, segmentKeys } from "./segment";

export type SmsState = { error?: string; notice?: string; savedAt?: number } | null;

const messageSchema = z.string().trim().min(1, "יש לכתוב הודעה").max(500, "עד 500 תווים");

// S-15 (REQ-13): admin only (decided 27/09/2026 — every send costs money and carries legal weight). Only candidates with
// marketing consent; each SMS carries a personal removal link and is written to the candidate's history.
export async function sendCampaign(_: SmsState, formData: FormData): Promise<SmsState> {
  const user = await requireAdmin();
  const message = messageSchema.safeParse(formData.get("message"));
  if (!message.success) return { error: message.error.issues[0].message };

  const raw = Object.fromEntries(segmentKeys.map((k) => [k, (formData.get(k) as string) || undefined]));
  const { where, label } = await resolveSegment(raw);
  const recipients = await db.candidate.findMany({ where: { AND: [where, { marketingConsent: true }] }, select: { id: true, phone: true, optOutToken: true } });
  if (!recipients.length) return { error: "אין נמענים עם הסכמה לדיוור בפילוח הזה" };

  for (const r of recipients.filter((r) => !r.optOutToken)) {
    r.optOutToken = newOptOutToken();
    await db.candidate.update({ where: { id: r.id }, data: { optOutToken: r.optOutToken } });
  }

  // ponytail: sends inside the request, 5 at a time — fine for hundreds; move to a background job for thousands.
  const sent: string[] = [];
  for (let i = 0; i < recipients.length; i += 5) {
    const batch = recipients.slice(i, i + 5);
    const results = await Promise.all(batch.map((r) => sendSms(r.phone, withOptOut(message.data, r.optOutToken!))));
    results.forEach((res, j) => (res.ok ? sent.push(batch[j].id) : console.error("sms failed", batch[j].id, res.error)));
  }

  const dryRun = !smsConfigured();
  await db.$transaction([
    db.smsCampaign.create({ data: { message: message.data, segment: label, sentCount: sent.length, failedCount: recipients.length - sent.length, dryRun, sentById: user.id } }),
    db.activity.createMany({ data: sent.map((candidateId) => ({ candidateId, userId: user.id, type: "sms" as const, body: `SMS תפוצה${dryRun ? " (בדיקה)" : ""}: ${message.data}` })) }),
  ]);
  revalidatePath("/sms");
  const failed = recipients.length - sent.length;
  return { savedAt: Date.now(), notice: `${dryRun ? "מצב בדיקה — " : ""}נשלחו ${sent.length}${failed ? `, נכשלו ${failed}` : ""}` };
}

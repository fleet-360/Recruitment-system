import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const segmentKeys = ["region", "city", "language", "status"] as const;
export type Segment = Partial<Record<(typeof segmentKeys)[number], string>>;

const listOf = { region: "region", city: "city", language: "language", status: "candidate_status" } as const;
const names = { region: "אזור", city: "עיר", language: "שפה", status: "סטטוס" } as const;

// Resolves the chosen ids against their lists (an id from another list is dropped) and builds the candidate filter
// + a readable label. The page and the send action both go through here, so the preview is exactly who gets the SMS.
export async function resolveSegment(raw: Segment) {
  const picked = await Promise.all(
    segmentKeys.map(async (k) => {
      const id = raw[k];
      const v = id ? await db.lookupValue.findFirst({ where: { id, listKey: listOf[k] }, select: { id: true, label: true } }) : null;
      return [k, v] as const;
    }),
  );
  const seg = Object.fromEntries(picked) as Record<(typeof segmentKeys)[number], { id: string; label: string } | null>;

  const where: Prisma.CandidateWhereInput = {
    AND: [
      { anonymizedAt: null },
      seg.region ? { city: { parentId: seg.region.id } } : {},
      seg.city ? { cityId: seg.city.id } : {},
      seg.language ? { languages: { some: { languageId: seg.language.id } } } : {},
      seg.status ? { statusId: seg.status.id } : {},
    ],
  };
  const label = segmentKeys.flatMap((k) => (seg[k] ? [`${names[k]}: ${seg[k].label}`] : [])).join(" · ") || "כל המועמדים";
  return { where, label };
}

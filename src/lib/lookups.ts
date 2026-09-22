import { db } from "@/lib/db";
import type { ListKey } from "@/generated/prisma/client";

export type Option = { id: string; label: string };

export const listNames: Record<ListKey, string> = {
  candidate_status: "סטטוסי מועמד",
  placement_status: "סטטוסי תהליך",
  rejection_reason: "סיבות דחייה",
  lead_source: "מקורות",
  language: "שפות",
  region: "אזורים",
  city: "ערים",
};

export function getList(listKey: ListKey): Promise<Option[]> {
  return db.lookupValue.findMany({
    where: { listKey, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true },
  });
}

// A record may still point at a value that was deactivated since — keep it selectable,
// otherwise saving the form would silently clear it.
export function withCurrent(options: Option[], ...current: (Option | null | undefined)[]): Option[] {
  const missing = current.filter((c): c is Option => !!c && !options.some((o) => o.id === c.id));
  return [...options, ...missing];
}

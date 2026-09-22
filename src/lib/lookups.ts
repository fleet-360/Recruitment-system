import { db } from "@/lib/db";
import type { ListKey } from "@/generated/prisma/client";

export type Option = { id: string; label: string };

export function getList(listKey: ListKey): Promise<Option[]> {
  return db.lookupValue.findMany({
    where: { listKey, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true },
  });
}

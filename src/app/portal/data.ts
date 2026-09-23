import { db } from "@/lib/db";
import { businessBranchIds, businessCandidateSelect } from "@/lib/access";
import type { CurrentUser } from "@/lib/session";

export type Stage = "active" | "hired" | "rejected" | "fired";

// The regular process steps (rejected / fired have their own forms). The last one — "התקבל סופית" — counts as hired.
export const processSteps = () =>
  db.lookupValue.findMany({
    where: { listKey: "placement_status", isActive: true, systemKey: null },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true },
  });

export function stageOf(p: { statusId: string | null; status: { systemKey: string | null } | null }, hiredId: string | undefined): Stage {
  if (p.status?.systemKey === "rejected") return "rejected";
  if (p.status?.systemKey === "fired") return "fired";
  return p.statusId && p.statusId === hiredId ? "hired" : "active";
}

// Placements in the user's branches. Candidate fields only through businessCandidateSelect — no phone, CV, ID or notes.
export async function myPlacements(user: CurrentUser) {
  const branchIds = await businessBranchIds(user);
  return db.placement.findMany({
    where: { job: { branchId: { in: branchIds } } },
    orderBy: { createdAt: "desc" },
    take: 500, // ponytail: no pagination, add when a business passes a few hundred placements
    select: {
      id: true,
      statusId: true,
      startDate: true,
      endDate: true,
      endReason: true,
      rejectionNote: true,
      createdAt: true,
      status: { select: { label: true, systemKey: true } },
      rejectionReason: { select: { label: true } },
      candidate: { select: businessCandidateSelect },
      job: { select: { id: true, title: true, branch: { select: { name: true } } } },
    },
  });
}

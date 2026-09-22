// Single permission layer: every candidate query must be scoped through here.
// Office (admin/recruiter) sees everything; business users only candidates placed in their branches,
// and only the fields in businessCandidateSelect (decided 22/09/2026: name, city, summary, placement status).
import { db } from "@/lib/db";
import { isOffice, type CurrentUser } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

export async function businessBranchIds(user: CurrentUser): Promise<string[]> {
  if (user.role === "company_admin" && user.companyId) {
    const branches = await db.branch.findMany({ where: { companyId: user.companyId }, select: { id: true } });
    return branches.map((b) => b.id);
  }
  const links = await db.userBranch.findMany({ where: { userId: user.id }, select: { branchId: true } });
  return links.map((l) => l.branchId);
}

export async function candidateWhere(user: CurrentUser): Promise<Prisma.CandidateWhereInput> {
  if (isOffice(user)) return {};
  const branchIds = await businessBranchIds(user);
  return { placements: { some: { job: { branchId: { in: branchIds } } } } };
}

export const businessCandidateSelect = {
  id: true,
  fullName: true,
  summary: true,
  city: { select: { label: true } },
} satisfies Prisma.CandidateSelect;

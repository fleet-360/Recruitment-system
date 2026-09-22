import { db } from "@/lib/db";
import type { BranchGroup } from "./job-form";

// All branches, grouped by company, for the job form's branch select.
export async function branchGroups(): Promise<BranchGroup[]> {
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, branches: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });
  return companies
    .filter((c) => c.branches.length)
    .map((c) => ({ companyId: c.id, company: c.name, branches: c.branches.map((b) => ({ id: b.id, label: `${c.name} · ${b.name}` })) }));
}

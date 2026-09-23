import { db } from "@/lib/db";
import { businessBranchIds } from "@/lib/access";
import type { CurrentUser } from "@/lib/session";
import type { BranchGroup } from "@/app/(office)/jobs/job-form";

// The user's own branches as one group — JobForm then shows a flat branch list.
export async function myBranchGroups(user: CurrentUser): Promise<BranchGroup[]> {
  const branches = await db.branch.findMany({
    where: { id: { in: await businessBranchIds(user) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, companyId: true, company: { select: { name: true } } },
  });
  if (!branches.length) return [];
  return [{ companyId: branches[0].companyId, company: branches[0].company.name, branches: branches.map((b) => ({ id: b.id, label: b.name })) }];
}

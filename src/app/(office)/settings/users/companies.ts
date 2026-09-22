import { db } from "@/lib/db";

// Companies with their branches, for the user form's company + branch pickers.
export const companiesWithBranches = () =>
  db.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, branches: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });

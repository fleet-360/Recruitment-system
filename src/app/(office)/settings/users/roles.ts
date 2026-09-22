import type { Role } from "@/generated/prisma/client";

export const roleNames: Record<Role, string> = {
  admin: "אדמין (משרד)",
  recruiter: "רכז/ת (משרד)",
  company_admin: "מנהל/ת חברה",
  branch_manager: "מנהל/ת סניף",
};

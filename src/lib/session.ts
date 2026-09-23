import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";

export type CurrentUser = { id: string; name: string | null; email: string; role: Role; companyId: string | null; mustChangePassword: boolean };

export const isOffice = (u: { role: Role }) => u.role === "admin" || u.role === "recruiter";

// Re-reads the user on every request so a deactivated user loses access immediately (the JWT alone would last 30 days).
export async function getUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, companyId: true, isActive: true, mustChangePassword: true },
  });
  if (!user?.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId, mustChangePassword: user.mustChangePassword };
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect((await auth()) ? "/login?error=AccessDenied" : "/login"); // session but inactive → show why
  if (user.mustChangePassword) redirect("/account/password"); // temporary password from an admin
  return user;
}

// Use in every office page AND every office server action — layouts don't protect actions.
export async function requireOffice() {
  const user = await requireUser();
  if (!isOffice(user)) redirect("/portal");
  return user;
}

export async function requireAdmin() {
  const user = await requireOffice();
  if (user.role !== "admin") redirect("/");
  return user;
}

// Every portal page and portal-only action.
export async function requireBusiness() {
  const user = await requireUser();
  if (isOffice(user)) redirect("/");
  return user;
}

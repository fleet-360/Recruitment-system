"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUser, isOffice } from "@/lib/session";

export type PasswordState = { error?: string } | null;

const schema = z
  .object({
    current: z.string().min(1, "יש להזין את הסיסמה הנוכחית"),
    password: z.string().min(8, "סיסמה חדשה — לפחות 8 תווים").max(100),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, "הסיסמאות לא תואמות")
  .refine((v) => v.password !== v.current, "הסיסמה החדשה זהה לנוכחית");

// Any signed-in user; forced after an admin sets a temporary password.
export async function changePassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await getUser(); // not requireUser — that would redirect back here
  if (!user) redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { passwordHash } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!passwordHash || !(await bcrypt.compare(parsed.data.current, passwordHash))) return { error: "הסיסמה הנוכחית שגויה" };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), mustChangePassword: false } });
  redirect(isOffice(user) ? "/" : "/portal");
}

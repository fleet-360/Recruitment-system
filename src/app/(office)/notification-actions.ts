"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { notificationHref } from "@/lib/notifications";

export async function openNotification(id: string) {
  const user = await requireOffice();
  const n = await db.notification.findFirst({ where: { id, userId: user.id } }); // only your own
  if (!n) return;
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/", "layout"); // the bell's count lives in the layout
  redirect(notificationHref(n));
}

export async function markAllRead() {
  const user = await requireOffice();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

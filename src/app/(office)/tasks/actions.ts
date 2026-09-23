"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";
import { candidateWhere } from "@/lib/access";
import { today } from "@/lib/fees";

export type TaskState = { error?: string; savedAt?: number } | null;

function refresh(candidateId: string | null) {
  revalidatePath("/");
  revalidatePath("/tasks");
  if (candidateId) revalidatePath(`/candidates/${candidateId}`);
}

const taskSchema = z.object({
  title: z.string().trim().min(1, "יש לכתוב מה צריך לעשות").max(200, "עד 200 תווים"),
  dueAt: z.iso.date("יש לבחור תאריך").transform((v) => new Date(v)), // date only — UTC midnight, like today()
  assignedToId: z.string().min(1, "יש לבחור אחראי"),
});

// S-13: any office user can open a task for any office user (a small office that covers for each other).
export async function createTask(candidateId: string | null, _: TaskState, formData: FormData): Promise<TaskState> {
  const user = await requireOffice();
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { title, dueAt, assignedToId } = parsed.data;
  if (dueAt < today()) return { error: "התאריך כבר עבר" };

  const assignee = await db.user.findFirst({ where: { id: assignedToId, isActive: true, role: { in: ["admin", "recruiter"] } }, select: { id: true } });
  if (!assignee) return { error: "האחראי לא נמצא — רעננו את הדף" };
  if (candidateId && !(await db.candidate.findFirst({ where: { AND: [{ id: candidateId }, await candidateWhere(user)] }, select: { id: true } }))) {
    return { error: "המועמד לא נמצא" };
  }

  await db.task.create({ data: { title, dueAt, assignedToId, candidateId } });
  refresh(candidateId);
  return { savedAt: Date.now() };
}

// Mark done / reopen (a mistaken click is undone from the "done" tab).
export async function setTaskDone(id: string, done: boolean) {
  await requireOffice();
  const task = await db.task.update({ where: { id }, data: { doneAt: done ? new Date() : null }, select: { candidateId: true } });
  refresh(task.candidateId);
}

import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { notifyOverdue } from "@/lib/notifications";
import { openOverdueTasks } from "@/lib/tasks";

// Daily job, called by the server's cron: curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) return new Response("Unauthorized", { status: 401 });

  const overdue = await notifyOverdue(db);
  const tasks = await openOverdueTasks(db);
  return Response.json({ overdue, tasks });
}

import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOffice } from "@/lib/session";

// Stable link to a placement (notifications): opens its drawer on the job page.
export default async function PlacementLink({ params }: PageProps<"/placements/[id]">) {
  await requireOffice();
  const { id } = await params;
  const p = await db.placement.findUnique({ where: { id }, select: { jobId: true } });
  if (!p) notFound();
  redirect(`/jobs/${p.jobId}?p=${id}`);
}

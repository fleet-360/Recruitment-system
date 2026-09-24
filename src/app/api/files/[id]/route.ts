import path from "node:path";
import { readFile } from "node:fs/promises";
import { db } from "@/lib/db";
import { getUser, isOffice } from "@/lib/session";
import { mimeByExt, uploadRoot } from "@/lib/uploads";
import { logAccess } from "@/lib/access-log";

// CVs are office-only (businesses never see CVs — decided 22/09/2026).
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await getUser();
  if (!user || user.mustChangePassword || !isOffice(user)) return new Response("Forbidden", { status: 403 });

  const { id } = await ctx.params;
  const file = await db.candidateFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });

  const data = await readFile(path.join(uploadRoot(), file.storagePath));
  await logAccess("cv_view", { email: user.email, userId: user.id, entityId: file.id }, req.headers);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeByExt[path.extname(file.storagePath)] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store", // CVs must not stay in shared or browser caches
    },
  });
}

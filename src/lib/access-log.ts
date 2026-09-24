import { db } from "@/lib/db";

// NFR-02 access log. Behind Caddy, X-Forwarded-For is set by Caddy itself (it doesn't trust the client's), so the first entry is the client.
export function logAccess(action: "login_ok" | "login_fail" | "cv_view", data: { email?: string; userId?: string; entityId?: string }, headers?: Headers) {
  const ip = headers?.get("x-forwarded-for")?.split(",")[0].trim() || headers?.get("x-real-ip") || null;
  return db.accessLog.create({ data: { action, ...data, ip } });
}

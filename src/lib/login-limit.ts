// Brute-force guard for email+password sign-in: after MAX_FAILS wrong passwords an email is locked for WINDOW_MS.
// ponytail: in-memory, one app process (our single VPS container) — move to a DB table if we ever run more than one.
export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

const fails = new Map<string, { count: number; first: number }>();

export function isLocked(email: string, now = Date.now()) {
  const f = fails.get(email);
  if (f && now - f.first > WINDOW_MS) fails.delete(email);
  return (fails.get(email)?.count ?? 0) >= MAX_FAILS;
}

export function recordFail(email: string, now = Date.now()) {
  const f = fails.get(email);
  if (!f || now - f.first > WINDOW_MS) fails.set(email, { count: 1, first: now });
  else f.count++;
}

export const clearFails = (email: string) => fails.delete(email);

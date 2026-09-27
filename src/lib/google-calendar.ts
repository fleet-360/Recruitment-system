import { db } from "@/lib/db";

// Task 25 (REQ-11): interview invites from the scheduling user's own Google Calendar. Plain fetch against the REST API —
// no googleapis dependency for two calls. The token comes from the Account row Auth.js saved at Google sign-in.

const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// A valid access token for the user, refreshed when expired. null = the user never signed in with Google (or revoked it).
async function accessToken(userId: string): Promise<string | null> {
  const acc = await db.account.findFirst({ where: { userId, provider: "google" } });
  if (!acc?.refresh_token || !process.env.AUTH_GOOGLE_ID) return null;
  if (acc.access_token && acc.expires_at && acc.expires_at * 1000 > Date.now() + 60_000) return acc.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID,
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: acc.refresh_token,
    }),
  });
  if (!res.ok) return null; // revoked, or a testing-mode token older than 7 days → the user signs in with Google again
  const t: { access_token: string; expires_in: number } = await res.json();
  await db.account.update({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: acc.providerAccountId } },
    data: { access_token: t.access_token, expires_at: Math.floor(Date.now() / 1000) + t.expires_in },
  });
  return t.access_token;
}

export type InviteInput = { start: Date; minutes: number; title: string; location: string | null; attendees: string[] };

// Returns the Google event id, or null when no invite went out (never throws — the interview is saved either way).
export async function createCalendarEvent(userId: string, e: InviteInput): Promise<string | null> {
  try {
    const token = await accessToken(userId);
    if (!token) return null;
    const res = await fetch(`${CALENDAR}?sendUpdates=all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: e.title,
        location: e.location ?? undefined,
        start: { dateTime: e.start.toISOString(), timeZone: "Asia/Jerusalem" },
        end: { dateTime: new Date(e.start.getTime() + e.minutes * 60_000).toISOString(), timeZone: "Asia/Jerusalem" },
        attendees: [...new Set(e.attendees.map((a) => a.toLowerCase()))].map((email) => ({ email })),
      }),
    });
    if (!res.ok) {
      console.error("google calendar create", res.status, await res.text());
      return null;
    }
    return ((await res.json()) as { id: string }).id;
  } catch (err) {
    console.error("google calendar create", err);
    return null;
  }
}

// Deletes the event from the organizer's calendar; Google sends the cancellation to the attendees.
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    const token = await accessToken(userId);
    if (!token) return false;
    const res = await fetch(`${CALENDAR}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    return res.ok || res.status === 410; // 410 = already deleted in Google
  } catch (err) {
    console.error("google calendar delete", err);
    return false;
  }
}

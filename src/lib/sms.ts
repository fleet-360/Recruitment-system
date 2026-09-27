// S-15 bulk SMS through InforU (decided 27/09/2026). JSON API v2, same call as the working service in fleet-360/Buildings-Service:
// INFORU_TOKEN is the whole Authorization value as InforU issues it; INFORU_SENDER is optional (account default otherwise).
// Without INFORU_TOKEN the send is a dry run: logged to the console, nothing delivered — until the client opens an account.
// No node: imports — the form imports smsSegments for its live counter.

export const smsConfigured = () => !!process.env.INFORU_TOKEN;

// Short random id for the removal link. 8 base64url chars ≈ 48 bits — unguessable enough for a one-click opt-out.
export const newOptOutToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(6))).toString("base64url");

const baseUrl = () => (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// Communications Law §30A: every marketing message carries an easy way to opt out.
export const withOptOut = (message: string, token: string) => `${message.trim()}\nלהסרה: ${baseUrl()}/u/${token}`;

// Segments the carrier bills: Hebrew (or any non-GSM char) → UCS-2, 70 chars alone / 67 per part; otherwise 160 / 153.
export function smsSegments(text: string): number {
  const gsm = /^[\x20-\x7E\n\r]*$/.test(text); // ponytail: printable ASCII as the GSM-7 test; the full alphabet only matters for Latin messages
  const [single, part] = gsm ? [160, 153] : [70, 67];
  return text.length <= single ? 1 : Math.ceil(text.length / part);
}

export async function sendSms(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!smsConfigured()) {
    console.log(`[sms dry run] ${phone}: ${text}`);
    return { ok: true };
  }
  try {
    const res = await fetch("https://capi.inforu.co.il/api/v2/SMS/SendSms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.INFORU_TOKEN!,
      },
      body: JSON.stringify({
        Data: { Message: text, Recipients: [{ Phone: phone }], ...(process.env.INFORU_SENDER ? { Settings: { Sender: process.env.INFORU_SENDER } } : {}) },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { StatusId?: number | string; StatusDescription?: string; Message?: string };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} - ${body.StatusDescription ?? body.Message ?? res.statusText}` };
    if (body.StatusId != null && Number(body.StatusId) !== 1) return { ok: false, error: `StatusId ${body.StatusId} - ${body.StatusDescription ?? "Unknown error"}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

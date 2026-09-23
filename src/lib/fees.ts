// Branch payment terms (REQ-15). All amounts are before VAT (decided 22/09/2026).
// Terms apply when a placement starts; later changes don't touch installments already created.

export type FeeType = "fixed" | "percent_of_salary";
export type TermRow = { sharePercent: number; daysAfterStart: number };

// Returns a Hebrew error, or null when the terms are valid.
export function termsError(feeType: FeeType, feeValue: number, rows: TermRow[]): string | null {
  if (!(feeValue > 0) || feeValue > 9_999_999) return feeType === "fixed" ? "יש להזין סכום עמלה" : "יש להזין אחוז משכר";
  if (!rows.length) return "יש להגדיר לפחות פעימה אחת";
  if (rows.some((r) => !(r.sharePercent > 0))) return "כל פעימה צריכה אחוז גדול מ-0";
  if (rows.some((r) => !Number.isInteger(r.daysAfterStart) || r.daysAfterStart < 0)) return "ימים מתחילת עבודה — מספר שלם, 0 ומעלה";
  const sum = rows.reduce((s, r) => s + Math.round(r.sharePercent * 100), 0) / 100;
  if (sum !== 100) return `סכום הפעימות ${sum}% — חייב להיות 100%`;
  return null;
}

// Total fee for one placement; null when it depends on a salary we don't have yet.
export function totalFee(feeType: FeeType, feeValue: number, salary?: number | null): number | null {
  if (feeType === "fixed") return feeValue;
  return salary ? Math.round(salary * feeValue) / 100 : null;
}

// Splits a total by the installment shares, in agorot. The last installment takes the rounding
// remainder, so the parts always add up to the total exactly.
export function splitFee(total: number, rows: TermRow[]): number[] {
  const agorot = Math.round(total * 100);
  let used = 0;
  return rows.map((r, i) => {
    const part = i === rows.length - 1 ? agorot - used : Math.round((agorot * r.sharePercent) / 100);
    used += part;
    return part / 100;
  });
}

const DAY = 86_400_000;
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

export type PlannedInstallment = TermRow & { seq: number; dueDate: Date; amount: number };

// Installments for a placement starting on `start` (a UTC-midnight date). null when a % fee has no salary yet.
// Also used to recalculate after a start date / salary change, from the terms copied onto the installments.
export function planInstallments(start: Date, feeType: FeeType, feeValue: number, salary: number | null, rows: TermRow[]): PlannedInstallment[] | null {
  const total = totalFee(feeType, feeValue, salary);
  if (total === null) return null;
  const amounts = splitFee(total, rows);
  return rows.map((r, i) => ({ ...r, seq: i + 1, dueDate: addDays(start, r.daysAfterStart), amount: amounts[i] }));
}

// Rejected / fired on `cutoff`: open installments due after it are cancelled; ones already due stay owed (decided 22/09/2026).
export const cancelledBy = (dueDate: Date, cutoff: Date) => dueDate.getTime() > cutoff.getTime();

// Today in Israel as a UTC-midnight date, comparable with @db.Date columns.
export const today = () => new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }));

// Israel wall-clock time ↔ real instants, for timestamp columns (createdAt, interviews).
const TZ = "Asia/Jerusalem";
const offsetAt = (at: Date) => Date.parse(at.toLocaleString("en-US", { timeZone: TZ })) - Date.parse(at.toLocaleString("en-US", { timeZone: "UTC" })); // +2h / +3h in summer

// "2026-09-24T10:30" (a datetime-local value, Israel time) → the instant.
export function fromIsraelLocal(local: string) {
  const asUtc = Date.parse(`${local.slice(0, 16)}Z`);
  return new Date(asUtc - offsetAt(new Date(asUtc)));
}

// The instant → "2026-09-24T10:30" in Israel time (for datetime-local inputs).
export const toIsraelLocal = (d: Date) => d.toLocaleString("sv-SE", { timeZone: TZ }).slice(0, 16).replace(" ", "T");

// Start of the Israeli day as a real instant — for "new today".
export const israelMidnight = (now = new Date()) => fromIsraelLocal(`${now.toLocaleDateString("en-CA", { timeZone: TZ })}T00:00`);

// Display in Israel time: "ה׳, 24.9, 10:30" / "10:30" / the Israeli date key "2026-09-24" (for grouping by day).
export const israelDateTime = (d: Date) => d.toLocaleString("he-IL", { timeZone: TZ, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
export const israelTime = (d: Date) => d.toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const israelDayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

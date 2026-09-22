// Month helpers for the collections calendar (S-14). Dates are UTC-midnight, like @db.Date columns.

// "2026-09" → first day of that month; anything else → the month of `fallback`.
export function parseMonth(value: string | undefined, fallback: Date): Date {
  const m = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
}

export const addMonths = (month: Date, n: number) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + n, 1));
export const monthKey = (month: Date) => month.toISOString().slice(0, 7);
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// Weeks (Sunday first, as in Israel) covering the month; days outside it are null.
export function monthGrid(month: Date): (Date | null)[][] {
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = Array(month.getUTCDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), d)));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

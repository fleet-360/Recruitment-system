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

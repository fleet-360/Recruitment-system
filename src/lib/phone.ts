// Israeli phone numbers → one canonical form ("0501234567") so duplicates are caught.
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("972")) d = d.slice(3);
  if (!d.startsWith("0")) d = "0" + d;
  return /^0\d{8,9}$/.test(d) ? d : null;
}

// For wa.me / tel links.
export const toIntl = (phone: string) => "972" + phone.slice(1);

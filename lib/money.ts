/** Money is integer cents everywhere; these helpers only format/parse for the UI. */

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "+$1.00" for positive add-on prices, "" for free. */
export function formatAddOn(cents: number): string {
  if (cents === 0) return "";
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/** Parse "1.5", "$1.50", "+1" → 150. Returns null when invalid. */
export function parseDollarsToCents(input: string): number | null {
  const s = input.trim().replace(/^\+/, "").replace(/^\$/, "").replace(/,/g, "");
  if (s === "" || s === "-" || s === "." || !/^-?\d*(\.\d{0,2})?$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) ? n : null;
}

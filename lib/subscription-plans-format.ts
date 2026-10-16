/** Formatowanie cen — bezpieczne dla klienta (bez server-only). */

export function formatPlnFromGrosze(grosze: number): string {
  const n = Math.max(0, Math.round(grosze)) / 100;
  return n.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parsePlnToGrosze(raw: string | number): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw * 100));
  }
  const s = String(raw)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

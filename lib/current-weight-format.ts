import type { CurrentWeight } from "@/lib/current-weight-types";

/** Etykieta wagi do UI: „82,4 kg” albo „82,4 kg · 24.10.2026”. */
export function formatCurrentWeightLabel(
  current: CurrentWeight | null,
  todayKey: string,
): string {
  if (!current) return "—";
  const kg = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 1,
  }).format(current.weightKg);
  const d = current.recordedAt;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const key = `${y}-${m}-${day}`;
  const yesterday = (() => {
    const t = new Date(`${todayKey}T12:00:00`);
    t.setDate(t.getDate() - 1);
    const yy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  })();
  if (key === todayKey || key === yesterday) return `${kg} kg`;
  return `${kg} kg · ${day}.${m}.${y}`;
}

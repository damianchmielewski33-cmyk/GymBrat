import { formatKgPl } from "@/lib/set-progression-suggestion";

export function formatWorkoutDurationPl(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  if (m > 0) return `${m} min`;
  return `${Math.max(1, s)} s`;
}

export function formatTonnagePl(kg: number): string {
  const n = Math.max(0, Math.round(kg));
  return `${new Intl.NumberFormat("pl-PL").format(n)} kg`;
}

export function formatWeightRecordLine(previousKg: number, newKg: number): string {
  return `${formatKgPl(previousKg)} → ${formatKgPl(newKg)} kg`;
}

export function workoutFinishFooterLine(workoutsThisWeekBeforeSave: number): string {
  const n = Math.max(1, workoutsThisWeekBeforeSave + 1);
  return `Po „Gotowe” zapiszesz ${n}. trening w tym tygodniu. Ciężary są w arkuszu postępów — Damian to widzi.`;
}

import { Target } from "lucide-react";
import { addCalendarDays } from "@/lib/local-date";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { countDistinctWorkoutDaysInRange } from "@/lib/weekly-sessions";

export async function FitnessGoalsWidget({
  userId,
  todayKey,
  fitnessGoalsJson,
}: {
  userId: string;
  todayKey: string;
  /** Z pierwszego zapytania na stronie Start — bez dodatkowego SELECT. */
  fitnessGoalsJson: string | null;
}) {
  const goals = parseFitnessGoalsJson(fitnessGoalsJson);
  const target = goals.weeklySessionsTarget;
  if (!target) return null;

  const start = addCalendarDays(todayKey, -6);
  const done = await countDistinctWorkoutDaysInRange(userId, start, todayKey);
  const pct = Math.min(100, Math.round((done / target) * 100));

  const ex = goals.exerciseTargets?.[0];

  return (
    <section className="glass-panel relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(640px_240px_at_100%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Target className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
              Cele
            </p>
            <p className="mt-1 text-sm text-white/80">
              Dni z treningiem (ostatnie 7 dni):{" "}
              <span className="font-semibold text-white">{done}</span> / {target}
            </p>
            {ex?.name ? (
              <p className="mt-1 text-xs text-white/55">
                Cel: {ex.name}
                {ex.targetKg != null ? ` · ${ex.targetKg} kg` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 sm:max-w-[200px]">
          <div
            className="h-full rounded-full bg-[var(--neon)] transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

import { auth } from "@/auth";
import { ProgressChartsDynamic } from "@/components/progress-analysis/progress-charts-dynamic";
import { ExerciseProgressDynamic } from "@/components/progress-analysis/exercise-progress-dynamic";
import { WeighInCard } from "@/components/progress-analysis/weigh-in-card";
import { getProgressAnalysisData } from "@/lib/progress-analysis";
import { listExerciseNameSuggestions } from "@/lib/exercise-progress";
import { ChartLine, Dumbbell, Layers3, Ruler, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

function AnalysisStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-h-[100px] flex-col rounded-[18px] bg-[#161616] px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <Icon
          className="h-[16px] w-[16px] shrink-0 text-[var(--gym-gold)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          {label}
        </p>
      </div>
      <p className="mt-3 font-display text-[26px] leading-none tracking-wide text-white">
        {value}
      </p>
      {hint ? (
        <p className="mt-auto pt-2 text-[11px] leading-snug text-white/40">{hint}</p>
      ) : (
        <div className="mt-auto pt-2" />
      )}
    </div>
  );
}

export default async function ProgressAnalysisPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [data, exerciseSuggestions] = await Promise.all([
    getProgressAnalysisData(userId),
    listExerciseNameSuggestions(userId, { days: 180 }),
  ]);
  const { series, stats } = data;
  const hasBody =
    stats.lastWaistCm != null || stats.lastChestCm != null || stats.lastThighCm != null;

  return (
    <div className="space-y-3">
      <header className="px-0.5 pb-1 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
          Postępy
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-white">
          Analiza
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Waga, tonaż, siła i pomiary z treningów oraz raportów — w tym samym stylu co Pulpit.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2.5">
        <AnalysisStat
          icon={Layers3}
          label="Sesje"
          value={String(stats.totalSessions)}
          hint="od początku"
        />
        <AnalysisStat
          icon={Dumbbell}
          label="Tonaż"
          value={`${stats.latestDailyVolumeKg}`}
          hint="kg · ostatni dzień"
        />
        <AnalysisStat
          icon={ChartLine}
          label="Siła"
          value={String(stats.latestStrengthScore)}
          hint="wskaźnik e1RM"
        />
        <AnalysisStat
          icon={Ruler}
          label="Waga"
          value={stats.lastWeightKg != null ? String(stats.lastWeightKg) : "—"}
          hint={
            stats.weightDeltaKg90d != null
              ? `${stats.weightDeltaKg90d > 0 ? "+" : ""}${stats.weightDeltaKg90d} kg / 90 dni`
              : "kg"
          }
        />
      </section>

      {hasBody ? (
        <section className="grid grid-cols-3 gap-2.5">
          {(
            [
              ["Pas", stats.lastWaistCm],
              ["Klatka", stats.lastChestCm],
              ["Udo", stats.lastThighCm],
            ] as const
          ).map(([label, cm]) => (
            <div
              key={label}
              className={cn(
                "rounded-[18px] bg-[#161616] px-3 py-3.5 text-center",
                cm == null && "opacity-50",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                {label}
              </p>
              <p className="mt-2 font-display text-[22px] tabular-nums text-white">
                {cm != null ? String(cm).replace(".", ",") : "—"}
              </p>
              <p className="mt-1 text-[10px] text-white/35">cm</p>
            </div>
          ))}
        </section>
      ) : null}

      <WeighInCard />

      <ProgressChartsDynamic
        weights={series.weights}
        volume={series.volume}
        strength={series.strength}
        relativeStrength={series.relativeStrength}
      />

      <ExerciseProgressDynamic suggestions={exerciseSuggestions} />
    </div>
  );
}

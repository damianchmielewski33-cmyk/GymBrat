import { auth } from "@/auth";
import { ProgressChartsDynamic } from "@/components/progress-analysis/progress-charts-dynamic";
import { ExerciseProgressDynamic } from "@/components/progress-analysis/exercise-progress-dynamic";
import { ExerciseLeaderboard } from "@/components/progress-analysis/exercise-leaderboard";
import { WeighInCard } from "@/components/progress-analysis/weigh-in-card";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";
import { getProgressAnalysisData } from "@/lib/progress-analysis";
import { listExerciseNameSuggestions } from "@/lib/exercise-progress";
import {
  ChartLine,
  Dumbbell,
  Gauge,
  Layers3,
  Ruler,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppPageHeader } from "@/components/layout/screen";

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
    <div className="app-card flex min-h-[100px] flex-col px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <Icon
          className="h-[16px] w-[16px] shrink-0 text-[var(--gym-gold)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="app-label text-[var(--gym-gold)]">{label}</p>
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

function formatPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${String(r).replace(".", ",")}%`;
}

export default async function ProgressAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [data, exerciseSuggestions] = await Promise.all([
    getProgressAnalysisData(userId),
    listExerciseNameSuggestions(userId, { days: 180 }),
  ]);
  const { series, stats, exerciseLeaderboard, topByE1rm, rirDistribution, periodCompare } =
    data;
  const hasBody =
    stats.lastWaistCm != null || stats.lastChestCm != null || stats.lastThighCm != null;
  const sp = await searchParams;
  const qRaw = sp?.q;
  const defaultQuery = Array.isArray(qRaw) ? qRaw[0] : qRaw;

  return (
    <div className="space-y-3">
      <AppPageHeader
        kicker="Postępy"
        title="Analiza"
        description="Tonaż, siła, RIR, serie i porównania ćwiczeń z ostatnich 90 dni — czytelne wykresy i rankingi."
      />

      <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
        <AnalysisStat
          icon={Layers3}
          label="Sesje"
          value={String(stats.totalSessions)}
          hint={`${periodCompare.recent30.sessions} w 30 dni`}
        />
        <AnalysisStat
          icon={Dumbbell}
          label="Tonaż"
          value={`${stats.latestDailyVolumeKg}`}
          hint={
            stats.avgVolume90d != null
              ? `śr. ${stats.avgVolume90d} kg / dzień z treningiem`
              : "kg · ostatni dzień"
          }
        />
        <AnalysisStat
          icon={ChartLine}
          label="Siła"
          value={String(stats.latestStrengthScore)}
          hint={`e1RM max ${stats.latestBestE1rm}`}
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
        <AnalysisStat
          icon={Gauge}
          label="Śr. RIR"
          value={
            stats.avgRir90d != null ? String(stats.avgRir90d).replace(".", ",") : "—"
          }
          hint={
            stats.hardSetsPct90d != null
              ? `${stats.hardSetsPct90d}% serii RIR≤1 · ${stats.setsDone90d} serii`
              : "90 dni"
          }
        />
        <AnalysisStat
          icon={Timer}
          label="Tempo"
          value={
            stats.tempoMatchPct90d != null ? `${stats.tempoMatchPct90d}%` : "—"
          }
          hint="zgodność z planem · 90 dni"
        />
      </section>

      <section className="grid gap-2.5 sm:grid-cols-3">
        <div className="app-card px-3.5 py-3.5">
          <p className="app-label text-[var(--gym-gold)]">Śr. 5 sesji</p>
          <p className="mt-2 font-display text-[22px] text-white">
            {stats.recent5AvgVolumeKg != null ? String(stats.recent5AvgVolumeKg) : "—"}
            <span className="ml-1 text-sm font-sans text-white/40">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            vs wcześniejsze 5: {formatPct(stats.recent5VsPrior5Percent)}
          </p>
        </div>
        <div className="app-card px-3.5 py-3.5">
          <p className="app-label text-[var(--gym-gold)]">30 dni · tonaż</p>
          <p className="mt-2 font-display text-[22px] text-white">
            {periodCompare.recent30.volumeKg}
            <span className="ml-1 text-sm font-sans text-white/40">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            vs poprzednie 30: {formatPct(periodCompare.volumeDeltaPercent)}
          </p>
        </div>
        <div className="app-card px-3.5 py-3.5">
          <p className="app-label text-[var(--gym-gold)]">30 dni · siła</p>
          <p className="mt-2 font-display text-[22px] text-white">
            {periodCompare.recent30.avgStrength || "—"}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            śr. wskaźnik · {formatPct(periodCompare.strengthDeltaPercent)}
          </p>
        </div>
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
              className={cn("app-card px-3 py-3.5 text-center", cm == null && "opacity-50")}
            >
              <p className="app-label text-[var(--gym-gold)]">{label}</p>
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
        avgRir={series.avgRir}
        sets={series.sets}
        exerciseLeaderboard={exerciseLeaderboard}
        topByE1rm={topByE1rm}
        rirDistribution={rirDistribution}
        periodCompare={periodCompare}
      />

      <ExerciseLeaderboard rows={exerciseLeaderboard} />

      <ExerciseProgressDynamic
        suggestions={exerciseSuggestions}
        defaultQuery={defaultQuery ?? null}
      />
      <WorkoutCompletePopup />
    </div>
  );
}

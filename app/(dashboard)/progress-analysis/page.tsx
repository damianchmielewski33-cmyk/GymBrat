import { auth } from "@/auth";
import { StatCard } from "@/components/reports/stat-card";
import { ProgressChartsDynamic } from "@/components/progress-analysis/progress-charts-dynamic";
import { ExerciseProgressDynamic } from "@/components/progress-analysis/exercise-progress-dynamic";
import { WeighInCard } from "@/components/progress-analysis/weigh-in-card";
import { getProgressAnalysisData } from "@/lib/progress-analysis";
import { listExerciseNameSuggestions } from "@/lib/exercise-progress";
import { ChartLine, Dumbbell, Layers3, Ruler } from "lucide-react";
import { redirect } from "next/navigation";
import { ScreenHeader } from "@/components/layout/screen";

export default async function ProgressAnalysisPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [data, exerciseSuggestions] = await Promise.all([
    getProgressAnalysisData(userId),
    listExerciseNameSuggestions(userId, { days: 180 }),
  ]);
  const { series, stats } = data;

  return (
    <div className="space-y-8">
      <ScreenHeader
        kicker="Podsumowanie"
        title="Analiza postępów"
        description={
          <>
            Zestawienie z ostatnich treningów: trend masy ciała, tonaż (suma powtórzeń × kilogramy),
            szacowane maksimum na jedno powtórzenie (e1RM, wzór Epleya) oraz siła względem masy ciała.
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Layers3}
          label="Łącznie sesji"
          value={String(stats.totalSessions)}
          hint="Od początku"
        />
        <StatCard
          icon={Dumbbell}
          label="Ostatni tonaż"
          value={`${stats.latestDailyVolumeKg} kg`}
          hint="Suma serii z ostatniego dnia treningu"
        />
        <StatCard
          icon={ChartLine}
          label="Wskaźnik siły"
          value={String(stats.latestStrengthScore)}
          hint="Na podstawie e1RM"
        />
        <StatCard
          icon={Ruler}
          label="Waga"
          value={stats.lastWeightKg != null ? `${stats.lastWeightKg} kg` : "—"}
          hint={
            stats.weightDeltaKg90d != null
              ? `Zmiana 90 dni: ${stats.weightDeltaKg90d} kg`
              : "Brak ważeń"
          }
        />
      </section>

      {stats.lastWaistCm != null || stats.lastChestCm != null || stats.lastThighCm != null ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Ruler}
            label="Pas"
            value={stats.lastWaistCm != null ? `${stats.lastWaistCm} cm` : "—"}
            hint={
              stats.lastBodyReportAt
                ? `Dane z raportu z ${stats.lastBodyReportAt.toLocaleDateString("pl-PL")}`
                : undefined
            }
          />
          <StatCard
            icon={Ruler}
            label="Klatka"
            value={stats.lastChestCm != null ? `${stats.lastChestCm} cm` : "—"}
            hint={
              stats.lastBodyReportAt
                ? `Dane z raportu z ${stats.lastBodyReportAt.toLocaleDateString("pl-PL")}`
                : undefined
            }
          />
          <StatCard
            icon={Ruler}
            label="Udo"
            value={stats.lastThighCm != null ? `${stats.lastThighCm} cm` : "—"}
            hint={
              stats.lastBodyReportAt
                ? `Dane z raportu z ${stats.lastBodyReportAt.toLocaleDateString("pl-PL")}`
                : undefined
            }
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProgressChartsDynamic
            weights={series.weights}
            volume={series.volume}
            strength={series.strength}
            relativeStrength={series.relativeStrength}
          />
          <ExerciseProgressDynamic suggestions={exerciseSuggestions} />
        </div>
        <div className="space-y-6">
          <WeighInCard />
          <div className="glass-panel relative overflow-hidden p-6">
            <div className="relative">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                Skrót
              </p>
              <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                Najważniejsze liczby
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                <li>
                  Ostatni tonaż:{" "}
                  <span className="font-semibold text-white">{stats.latestDailyVolumeKg} kg</span>
                </li>
                <li>
                  Wskaźnik siły:{" "}
                  <span className="font-semibold text-white">{stats.latestStrengthScore}</span>
                </li>
                <li>
                  Waga:{" "}
                  <span className="font-semibold text-white">
                    {stats.lastWeightKg != null ? `${stats.lastWeightKg} kg` : "—"}
                  </span>
                  {stats.weightDeltaKg90d != null ? (
                    <span className="text-white/45">
                      {" "}
                      · zmiana w 90 dniach: {stats.weightDeltaKg90d} kg
                    </span>
                  ) : null}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="glass-panel relative overflow-hidden p-6">
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Metodyka
            </p>
            <h2 className="font-heading mt-1 text-lg font-semibold text-white">
              Skąd biorą się te wykresy
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Masę ciała pokazujemy na podstawie zapisanych ważeń. Tonaż i wskaźnik siły liczymy z
              ukończonych serii (powtórzenia × kilogramy) oraz ze szacunku jednorazowego maksimum
              (e1RM, wzór Epleya).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

import { auth } from "@/auth";
import { StatCard } from "@/components/reports/stat-card";
import { ProgressChartsDynamic } from "@/components/progress-analysis/progress-charts-dynamic";
import { ExerciseProgressDynamic } from "@/components/progress-analysis/exercise-progress-dynamic";
import { CoachChatPanel } from "@/components/coach/coach-chat-panel";
import { WeighInCard } from "@/components/progress-analysis/weigh-in-card";
import { getProgressAnalysisData } from "@/lib/progress-analysis";
import { listExerciseNameSuggestions } from "@/lib/exercise-progress";
import { isAiConfigured } from "@/ai/client";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { BrainCircuit, ChartLine, Dumbbell, Layers3, Ruler, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ProgressAnalysisPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [data, exerciseSuggestions, userAiDisabled] = await Promise.all([
    getProgressAnalysisData(userId),
    listExerciseNameSuggestions(userId, { days: 180 }),
    getUserAiFeaturesDisabled(userId),
  ]);
  const { series, stats } = data;
  const aiProviderOn = isAiConfigured();
  const coachModelOn = aiProviderOn && !userAiDisabled;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Sygnały
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Analiza postępów
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Tygodniowe sygnały: trend wagi, tonnage (∑reps×kg), e1RM oraz siła względna.
          {userAiDisabled ? (
            <>
              {" "}
              Wyłączyłeś funkcje AI w profilu — czat trenera nie wywołuje modelu, dopóki tego nie zmienisz.
            </>
          ) : !aiProviderOn ? (
            <>
              {" "}
              Czat coach używa kontekstu z aplikacji — skonfiguruj AI (np.{" "}
              <span className="font-mono">AI_PROVIDER</span> +{" "}
              <span className="font-mono">AI_API_KEY</span> dla Gemini albo relaya), aby włączyć odpowiedzi modelu.
            </>
          ) : (
            <>
              {" "}
              Czat coach jest podłączony do modelu (AI skonfigurowane).
            </>
          )}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Layers3}
          label="Łącznie sesji"
          value={String(stats.totalSessions)}
          hint="Od początku"
        />
        <StatCard
          icon={ChartLine}
          label="Ostatni tonnage"
          value={`${stats.latestDailyVolumeKg} kg`}
          hint="Suma (reps×kg) w ostatnim dniu z treningiem"
        />
        <StatCard
          icon={Dumbbell}
          label="Wskaźnik siły"
          value={`${stats.latestStrengthScore}`}
          hint="Suma najlepszego e1RM na ćwiczenie"
        />
        <StatCard
          icon={Sparkles}
          label="Masa ciała"
          value={stats.lastWeightKg != null ? `${stats.lastWeightKg} kg` : "—"}
          hint={
            stats.weightDeltaKg90d != null
              ? `Δ ${stats.weightDeltaKg90d} kg (90d)`
              : "Dodaj ważenie, aby zacząć śledzić"
          }
        />
      </section>

      {(stats.lastWaistCm != null || stats.lastChestCm != null || stats.lastThighCm != null) ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Ruler}
            label="Pas"
            value={stats.lastWaistCm != null ? `${stats.lastWaistCm} cm` : "—"}
            hint={stats.lastBodyReportAt ? `Z raportu: ${stats.lastBodyReportAt.toLocaleDateString()}` : undefined}
          />
          <StatCard
            icon={Ruler}
            label="Klatka"
            value={stats.lastChestCm != null ? `${stats.lastChestCm} cm` : "—"}
            hint={stats.lastBodyReportAt ? `Z raportu: ${stats.lastBodyReportAt.toLocaleDateString()}` : undefined}
          />
          <StatCard
            icon={Ruler}
            label="Udo"
            value={stats.lastThighCm != null ? `${stats.lastThighCm} cm` : "—"}
            hint={stats.lastBodyReportAt ? `Z raportu: ${stats.lastBodyReportAt.toLocaleDateString()}` : undefined}
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
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
          <div id="coach-chat" className="scroll-mt-24">
            <CoachChatPanel modelEnabled={coachModelOn} />
          </div>
          <div className="glass-panel neon-glow relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.10),transparent_55%),radial-gradient(640px_280px_at_15%_10%,rgba(255,45,85,0.16),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                    Integracja AI
                  </p>
                  <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                    Auto-wnioski z trendów
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    Podsumowania tygodniowe i wykrywanie stagnacji — rozszerzymy na bazie
                    historii treningów i raportów.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
                  <BrainCircuit className="h-5 w-5 text-[var(--neon)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="glass-panel relative overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(900px_420px_at_20%_0%,rgba(120,120,255,0.12),transparent_60%)]" />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Twoje statystyki
            </p>
            <h2 className="font-heading mt-1 text-lg font-semibold text-white">
              Co śledzimy
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Waga pochodzi z ważeń. Tonnage i siła są liczone z ukończonych serii (reps×kg)
              oraz e1RM (Epley).               RPE możesz już logować w aktywnym treningu; rozszerzenia typu VBT są w planach.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

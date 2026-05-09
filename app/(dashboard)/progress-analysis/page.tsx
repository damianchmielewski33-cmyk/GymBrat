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
import { isAiGloballyDisabled } from "@/lib/ai-availability";
import { InlineBanner } from "@/components/ui/inline-banner";

export default async function ProgressAnalysisPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [data, exerciseSuggestions, userAiDisabled, globalOff] = await Promise.all([
    getProgressAnalysisData(userId),
    listExerciseNameSuggestions(userId, { days: 180 }),
    getUserAiFeaturesDisabled(userId),
    isAiGloballyDisabled(),
  ]);
  const { series, stats } = data;
  const aiProviderOn = isAiConfigured();
  const coachMode = globalOff ? "web" : aiProviderOn && !userAiDisabled ? "ai" : "web";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Podsumowanie
        </p>
        <h1 className="font-heading metallic-text mt-2 text-2xl font-semibold sm:text-3xl">
          Analiza postępów
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-white/65">
          Zestawienie z ostatnich treningów: trend masy ciała, tonaż (suma powtórzeń × kilogramy),
          szacowane maksimum na jedno powtórzenie (e1RM, wzór Epleya) oraz siła względem masy ciała.
          {globalOff ? (
            <>
              {" "}
              Administrator wyłączył funkcje AI — czat trenera korzysta wtedy z publicznych źródeł w
              internecie (jeśli są skonfigurowane).
            </>
          ) : userAiDisabled ? (
            <>
              {" "}
              Masz wyłączone funkcje AI w profilu — czat nie wywołuje modelu, dopóki ich nie włączysz
              ponownie.
            </>
          ) : !aiProviderOn ? (
            <>
              {" "}
              Czat ma dostęp do danych z aplikacji; aby korzystał z modelu językowego, skonfiguruj AI
              (np. zmienne{" "}
              <span className="font-mono">AI_PROVIDER</span> i{" "}
              <span className="font-mono">AI_API_KEY</span> dla Gemini lub połączenia z Ollamą przez
              serwer pośredniczący).
            </>
          ) : (
            <>
              {" "}
              Czat trenera jest podłączony do skonfigurowanego modelu AI.
            </>
          )}
        </p>
      </header>

      {globalOff ? (
        <InlineBanner variant="warning">
          Administrator wyłączył funkcje AI. Na tej stronie nie pokazujemy modułów opartych na modelu; czat
          trenera — jeśli jest dostępny — korzysta z publicznych źródeł w sieci.
        </InlineBanner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Layers3}
          label="Łącznie sesji"
          value={String(stats.totalSessions)}
          hint="Od początku"
        />
        <StatCard
          icon={ChartLine}
          label="Ostatni tonaż"
          value={`${stats.latestDailyVolumeKg} kg`}
          hint="Suma (powtórzenia × kg) w ostatnim dniu, w którym był trening"
        />
        <StatCard
          icon={Dumbbell}
          label="Wskaźnik siły"
          value={`${stats.latestStrengthScore}`}
          hint="Suma najlepszych szacunków e1RM (Epley) z ćwiczeń w danym dniu"
        />
        <StatCard
          icon={Sparkles}
          label="Masa ciała"
          value={stats.lastWeightKg != null ? `${stats.lastWeightKg} kg` : "—"}
          hint={
            stats.weightDeltaKg90d != null
              ? `Zmiana: ${stats.weightDeltaKg90d} kg w ciągu 90 dni`
              : "Zapisz masę ciała, aby śledzić trend"
          }
        />
      </section>

      {(stats.lastWaistCm != null || stats.lastChestCm != null || stats.lastThighCm != null) ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Ruler}
            label="Pas"
            value={stats.lastWaistCm != null ? `${stats.lastWaistCm} cm` : "—"}
            hint={stats.lastBodyReportAt ? `Dane z raportu z ${stats.lastBodyReportAt.toLocaleDateString("pl-PL")}` : undefined}
          />
          <StatCard
            icon={Ruler}
            label="Klatka"
            value={stats.lastChestCm != null ? `${stats.lastChestCm} cm` : "—"}
            hint={stats.lastBodyReportAt ? `Dane z raportu z ${stats.lastBodyReportAt.toLocaleDateString("pl-PL")}` : undefined}
          />
          <StatCard
            icon={Ruler}
            label="Udo"
            value={stats.lastThighCm != null ? `${stats.lastThighCm} cm` : "—"}
            hint={stats.lastBodyReportAt ? `Dane z raportu z ${stats.lastBodyReportAt.toLocaleDateString("pl-PL")}` : undefined}
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
            <CoachChatPanel mode={coachMode} />
          </div>
          {globalOff ? (
            <div className="glass-panel neon-glow relative overflow-hidden p-6">
              <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(720px_260px_at_15%_0%,rgba(255,45,85,0.12),transparent_60%)]" />
              <div className="relative">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                  Podsumowanie (bez modelu AI)
                </p>
                <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                  Najważniejsze liczby z aplikacji
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  <li>
                    Ostatni tonaż: <span className="font-semibold text-white">{stats.latestDailyVolumeKg} kg</span>
                  </li>
                  <li>
                    Wskaźnik siły: <span className="font-semibold text-white">{stats.latestStrengthScore}</span>
                  </li>
                  <li>
                    Waga:{" "}
                    <span className="font-semibold text-white">
                      {stats.lastWeightKg != null ? `${stats.lastWeightKg} kg` : "—"}
                    </span>{" "}
                    {stats.weightDeltaKg90d != null ? (
                      <span className="text-white/45">
                        {" "}
                        · zmiana w 90 dniach: {stats.weightDeltaKg90d} kg
                      </span>
                    ) : null}
                  </li>
                </ul>
                <p className="mt-3 text-xs text-white/45">
                  Powyższe wartości wyliczamy automatycznie z zapisanych treningów i pomiarów. Obsługa
                  narracyjnych podsumowań przez model AI zależy od ustawień administratora.
                </p>
              </div>
            </div>
          ) : null}
          {!globalOff ? (
            <div className="glass-panel neon-glow relative overflow-hidden p-6">
              <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.10),transparent_55%),radial-gradient(640px_280px_at_15%_10%,rgba(255,45,85,0.16),transparent_60%)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                      Plan rozwoju
                    </p>
                    <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                      Automatyczne podsumowania trendów
                    </h2>
                    <p className="mt-2 text-sm text-white/60">
                      W przyszłości dodamy m.in. krótkie podsumowania tygodniowe i sygnały stagnacji — na
                      podstawie historii treningów i raportów.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
                    <BrainCircuit className="h-5 w-5 text-[var(--neon)]" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <section>
        <div className="glass-panel relative overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(900px_420px_at_20%_0%,rgba(120,120,255,0.12),transparent_60%)]" />
          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Metodyka
            </p>
            <h2 className="font-heading mt-1 text-lg font-semibold text-white">
              Skąd biorą się te wykresy
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Masę ciała pokazujemy na podstawie zapisanych ważeń. Tonaż i wskaźnik siły liczymy z ukończonych
              serii (powtórzenia × kilogramy) oraz ze szacunku jednorazowego maksimum (e1RM, wzór Epleya). Subiektywną
              ocenę wysiłku (RPE) możesz zapisywać w trakcie aktywnego treningu; w planach są m.in. rozszerzenia w
              stylu pomiaru prędkości powtórzenia (VBT).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

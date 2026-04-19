import { auth } from "@/auth";
import { StatCard } from "@/components/reports/stat-card";
import { ProgressChartsDynamic } from "@/components/progress-analysis/progress-charts-dynamic";
import { WeighInCard } from "@/components/progress-analysis/weigh-in-card";
import { getProgressAnalysisData } from "@/lib/progress-analysis";
import { BrainCircuit, ChartLine, Dumbbell, Layers3, Sparkles } from "lucide-react";

export default async function ProgressAnalysisPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const data = await getProgressAnalysisData(userId);
  const { series, stats } = data;

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
          Tygodniowe sygnały: trend wagi, objętość treningowa i przybliżony wskaźnik siły.
          Integracja AI jest gotowa — prawdziwy coaching dołączymy później.
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
          label="Ostatnia objętość"
          value={`${stats.latestDailyVolumeReps} powt.`}
          hint="Ostatni dzień z ukończonymi seriami"
        />
        <StatCard
          icon={Dumbbell}
          label="Wskaźnik siły"
          value={`${stats.latestStrengthScore} powt.`}
          hint="Najlepsza seria dnia (placeholder)"
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <ProgressChartsDynamic
            weights={series.weights}
            volume={series.volume}
            strength={series.strength}
          />
        </div>
        <div className="space-y-6">
          <WeighInCard />
          <div className="glass-panel neon-glow relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.10),transparent_55%),radial-gradient(640px_280px_at_15%_10%,rgba(255,45,85,0.16),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                    Integracja AI
                  </p>
                  <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                    Wnioski trenerskie
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    Placeholder: podsumowanie trendów, wykrywanie stagnacji i rekomendacje
                    korekt na następny tydzień.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
                  <BrainCircuit className="h-5 w-5 text-[var(--neon)]" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                  W planach
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li>• Podsumowanie treningów (ostatnie 14 / 30 dni)</li>
                  <li>• Skoki objętości i flagi ryzyka regeneracji</li>
                  <li>• Propozycje korekt planu pod Twój cel</li>
                </ul>
              </div>

              <button
                type="button"
                disabled
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-white/50"
              >
                Generuj wnioski (wkrótce)
              </button>
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
              Waga pochodzi z ważeń. Objętość i “siła” są liczone na podstawie ukończonych
              serii zapisanych w JSON treningu. Następny krok: dodanie obciążenia (kg),
              żeby policzyć realne krzywe siły.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

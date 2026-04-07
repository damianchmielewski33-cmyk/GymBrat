import { RefreshCw } from "lucide-react";
import { refreshFitatuMacros } from "@/actions/fitatu";
import { Button } from "@/components/ui/button";
import type { FitatuDaySummary } from "@/types/fitatu";

export function TodaysMacrosSection({ data }: { data: FitatuDaySummary }) {
  const protein = data.macros.protein;
  const fat = data.macros.fat;
  const carbs = data.macros.carbs;

  return (
    <div className="glass-panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/10 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            Dzisiejsze makra
          </p>
          <h2 className="font-heading mt-1 text-xl font-semibold">Paliwo na dziś</h2>
          <p className="mt-1 text-sm text-white/60">
            {data.source === "mock"
              ? "Pokazuję dane demo — skonfiguruj proxy Fitatu w env, aby pobierać na żywo."
              : "Pobrane z integracji Fitatu (cache na edge)."}
          </p>
        </div>
        <form action={refreshFitatuMacros}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="border-white/15 bg-white/5"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Odśwież
          </Button>
        </form>
      </div>

      <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Calories
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">
            {Math.round(data.caloriesConsumed)}
            <span className="ml-1 text-base font-normal text-white/55">kcal</span>
          </p>
          {data.caloriesGoal ? (
            <p className="mt-2 text-xs text-white/45">
              Cel ~{Math.round(data.caloriesGoal)} kcal
            </p>
          ) : (
            <p className="mt-2 text-xs text-white/45">Brak ustawionego celu</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Protein
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">
            {Math.round(protein)}
            <span className="ml-1 text-base font-normal text-white/55">g</span>
          </p>
          <p className="mt-2 text-xs text-white/45">Budowa i regeneracja</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Tłuszcze
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">
            {Math.round(fat)}
            <span className="ml-1 text-base font-normal text-white/55">g</span>
          </p>
          <p className="mt-2 text-xs text-white/45">Hormony i sytość</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Carbs
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">
            {Math.round(carbs)}
            <span className="ml-1 text-base font-normal text-white/55">g</span>
          </p>
          <p className="mt-2 text-xs text-white/45">Paliwo do wysiłku</p>
        </div>
      </div>
    </div>
  );
}

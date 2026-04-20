import { RefreshCw } from "lucide-react";
import { refreshFitatuMacros } from "@/actions/fitatu";
import { Button } from "@/components/ui/button";
import type { FitatuDaySummary } from "@/types/fitatu";

function fmtDelta(n: number, unit: string) {
  const r = Math.round(n);
  if (r > 0) return `+${r} ${unit}`;
  if (r < 0) return `${r} ${unit}`;
  return `0 ${unit}`;
}

function RemainingBlock({
  label,
  remaining,
  consumed,
  goal,
  unit,
  hint,
}: {
  label: string;
  remaining: number | null;
  consumed: number;
  goal?: number;
  unit: string;
  hint: string;
}) {
  const over =
    remaining != null && remaining < 0 ? Math.abs(remaining) : 0;
  const displayRemaining =
    remaining == null ? null : remaining < 0 ? 0 : remaining;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
      <p className="font-heading mt-2 text-3xl font-semibold tracking-tight">
        {displayRemaining == null ? (
          "—"
        ) : (
          <>
            {Math.round(displayRemaining)}
            <span className="ml-1 text-base font-normal text-white/55">{unit}</span>
          </>
        )}
      </p>
      <p className="mt-2 text-xs text-white/45">
        {goal != null && Number.isFinite(goal) ? (
          <>
            Spożyte {Math.round(consumed)} / cel {Math.round(goal)} {unit}
            {over > 0 ? (
              <span className="ml-1 text-rose-300/90">
                (nadwyżka {Math.round(over)} {unit})
              </span>
            ) : null}
          </>
        ) : (
          <>Spożyte: {Math.round(consumed)} {unit}</>
        )}
      </p>
      <p className="mt-1 text-xs text-white/35">{hint}</p>
    </div>
  );
}

export function TodaysMacrosSection({
  data,
  consumptionHint,
}: {
  data: FitatuDaySummary;
  /** Opcjonalny tekst pod nagłówkiem (np. cele z profilu). */
  consumptionHint?: string;
}) {
  const consumed = data.macros;
  const goals = data.macroGoals;

  const calGoal = data.caloriesGoal;
  const calRem =
    calGoal != null && Number.isFinite(calGoal)
      ? calGoal - data.caloriesConsumed
      : null;

  const pRem =
    goals != null && goals.protein > 0
      ? goals.protein - consumed.protein
      : null;
  const fRem =
    goals != null && goals.fat > 0 ? goals.fat - consumed.fat : null;
  const cRem =
    goals != null && goals.carbs > 0 ? goals.carbs - consumed.carbs : null;

  return (
    <div className="glass-panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/10 blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
            Żywienie
          </p>
          <h2 className="font-heading mt-1 text-xl font-semibold">
            Wartości odżywcze na dziś — pozostało do spożycia
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {data.source === "error" && data.errorMessage
              ? data.errorMessage
              : consumptionHint
                ? consumptionHint
                : data.source === "mock"
                  ? "Tryb demo — dodaj posiłek lub ustaw proxy i token w profilu, aby zobaczyć dane na żywo."
                  : data.source === "unavailable"
                    ? "Bez integracji Fitatu nadal widzisz cele z profilu; spożycie to tylko Twoje wpisy posiłków (bez wpisów — zero)."
                    : "Dodawaj posiłki powyżej — makra na dziś to suma wpisów. Przycisk Odśwież aktualizuje cache integracji (cele z Fitatu)."}
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

      {data.source === "error" ? null : (
        <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RemainingBlock
            label="Kalorie"
            remaining={calRem}
            consumed={data.caloriesConsumed}
            goal={calGoal}
            unit="kcal"
            hint="Energia na regenerację i trening"
          />
          <RemainingBlock
            label="Białko"
            remaining={pRem}
            consumed={consumed.protein}
            goal={goals?.protein}
            unit="g"
            hint="Regeneracja mięśni"
          />
          <RemainingBlock
            label="Węglowodany"
            remaining={cRem}
            consumed={consumed.carbs}
            goal={goals?.carbs}
            unit="g"
            hint="Paliwo na wysiłek"
          />
          <RemainingBlock
            label="Tłuszcz"
            remaining={fRem}
            consumed={consumed.fat}
            goal={goals?.fat}
            unit="g"
            hint="Hormony i sytość"
          />
        </div>
      )}

      {data.source !== "error" &&
      calRem != null &&
      goals == null &&
      calGoal != null ? (
        <p className="relative mt-4 text-xs text-amber-200/80">
          Proxy nie zwróciło celów makro (
          <span className="font-mono">proteinGoalG</span>,{" "}
          <span className="font-mono">carbsGoalG</span>,{" "}
          <span className="font-mono">fatGoalG</span>) — pokazuję pełny bilans tylko dla
          kalorii. Bilans: {fmtDelta(calRem, "kcal")} względem celu {Math.round(calGoal)} kcal.
        </p>
      ) : null}
    </div>
  );
}

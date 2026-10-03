import type { FitatuDaySummary } from "@/types/fitatu";

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
    <div className="app-card p-4">
      <p className="app-label">{label}</p>
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
  embedded,
}: {
  data: FitatuDaySummary;
  /** Opcjonalny tekst pod nagłówkiem (np. cele z profilu). */
  consumptionHint?: string;
  /** Bez zewnętrznej ramki glass — np. pod kafelkiem na starcie. */
  embedded?: boolean;
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

  const shell = embedded
    ? "relative overflow-hidden app-card p-4 sm:p-6"
    : "app-card relative overflow-hidden p-4 sm:p-6";

  return (
    <div className={shell}>
      {!embedded ? (
        <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/10 blur-3xl" />
      ) : (
        <div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/8 blur-3xl opacity-70" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Żywienie
        </p>
        <h2 className="font-heading mt-1 text-lg font-semibold leading-snug sm:text-xl">
          Wartości odżywcze na dziś — pozostało do spożycia
        </h2>
        <p className="mt-1 text-sm text-white/60">
          {consumptionHint ??
            "Spożycie to suma wpisów z dziennika (skan / wyszukiwanie). Cele ustawiasz w profilu."}
        </p>
      </div>

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
          hint="Budowa i regeneracja mięśni"
        />
        <RemainingBlock
          label="Tłuszcz"
          remaining={fRem}
          consumed={consumed.fat}
          goal={goals?.fat}
          unit="g"
          hint="Hormony i sytość"
        />
        <RemainingBlock
          label="Węglowodany"
          remaining={cRem}
          consumed={consumed.carbs}
          goal={goals?.carbs}
          unit="g"
          hint="Paliwo na trening"
        />
      </div>
    </div>
  );
}

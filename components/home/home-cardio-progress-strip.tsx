import { Footprints, Info, Plus } from "lucide-react";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";

type Props = {
  minutesCompleted: number;
  weeklyGoal: number;
  extraCardio?: ExtraCardioAdvice | null;
  /** Szybki zapis cardio — przycisk w nagłówku karty. */
  onAddCardio?: () => void;
};

function weeklyCardioPercent(minutesCompleted: number, weeklyGoal: number): number {
  if (weeklyGoal <= 0) return 0;
  return Math.min(100, Math.round((minutesCompleted / weeklyGoal) * 1000) / 10);
}

/**
 * Osobna karta cardio na Pulpicie: złoty pasek do celu tygodnia,
 * a bonus z nadwyżki makro jako niebieska kropka pod paskiem.
 * Całość jest statyczna — nic się nie rozwija i nie nawiguje.
 */
export function HomeCardioProgressStrip({
  minutesCompleted,
  weeklyGoal,
  extraCardio = null,
  onAddCardio,
}: Props) {
  const pct = weeklyCardioPercent(minutesCompleted, weeklyGoal);
  const mins = Math.round(minutesCompleted);
  const extraMinutes =
    extraCardio?.show && extraCardio.extraMinutes > 0
      ? extraCardio.extraMinutes
      : 0;

  return (
    <section
      className="app-card p-4"
      aria-label={`Cardio w tym tygodniu: ${mins} z ${weeklyGoal} minut${
        extraMinutes > 0
          ? `, plus ${extraMinutes} minut z nadwyżki makro`
          : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10">
          <Footprints
            className="h-4 w-4 text-[var(--gym-gold)]"
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Cardio · ten tydzień
          </p>
          <p className="mt-0.5 font-heading text-[15px] leading-none tabular-nums text-white">
            <span className="text-[var(--gym-gold)]">{mins}</span>
            <span className="text-white/35"> / {weeklyGoal} min</span>
          </p>
        </div>
        {onAddCardio ? (
          <button
            type="button"
            onClick={onAddCardio}
            aria-label="Dodaj cardio"
            className="gym-tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-gold)]/45 bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)] transition hover:bg-[rgba(var(--neon-rgb),0.2)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={weeklyGoal}
        aria-valuenow={Math.min(mins, weeklyGoal)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] via-[var(--gym-gold)] to-[var(--gym-gold-bright)] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {extraMinutes > 0 ? (
        <p className="mt-2.5 flex items-center gap-2 text-[12px] leading-none text-sky-200/90">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-sky-400"
            aria-hidden
          />
          <span>+{extraMinutes} min z nadwyżki makro</span>
          <Info
            className="h-3.5 w-3.5 shrink-0 text-sky-200/60"
            aria-hidden
          />
        </p>
      ) : null}
    </section>
  );
}

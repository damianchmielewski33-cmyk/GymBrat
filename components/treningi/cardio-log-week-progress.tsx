"use client";

export type CardioWeekProgress = {
  minutesCompleted: number;
  goalMinutes: number;
  weekLabel: string;
};

type Props = {
  weekProgress: CardioWeekProgress | null;
  /** Podgląd po zapisie (szacunek klienta), gdy data wpada w bieżący tydzień. */
  previewAfter?: number | null;
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function CardioLogWeekProgress({ weekProgress, previewAfter }: Props) {
  if (!weekProgress) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[13px] text-[var(--gym-text-secondary)]">
          Postęp tygodnia chwilowo niedostępny.
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--gym-text-secondary)]">
          Wpis zapisze się mimo to.
        </p>
      </div>
    );
  }

  const { minutesCompleted, goalMinutes, weekLabel } = weekProgress;
  const after =
    previewAfter != null && previewAfter > minutesCompleted
      ? previewAfter
      : minutesCompleted;
  const added = after - minutesCompleted;
  const scale = Math.max(after, goalMinutes, 1);
  const oldPct = (minutesCompleted / scale) * 100;
  const newPct = (added / scale) * 100;
  const goalPct = goalMinutes > 0 ? (goalMinutes / scale) * 100 : 0;
  const reached = goalMinutes > 0 && after >= goalMinutes;
  const over = after - goalMinutes;

  return (
    <div className="rounded-2xl border border-[var(--gym-border-gold)] bg-black/30 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          Ten tydzień · {weekLabel}
        </p>
        <p
          className={
            "text-[11px] font-bold " +
            (reached ? "text-[var(--gym-success)]" : "text-[var(--gym-gold)]")
          }
        >
          {reached ? "Cel zrobiony" : "W trakcie"}
        </p>
      </div>

      <p className="mt-1.5 flex items-baseline gap-2 tabular-nums">
        {added > 0 ? (
          <>
            <span className="font-metric text-[28px] leading-none text-white/55">
              {minutesCompleted}
            </span>
            <span className="text-[16px] font-semibold text-[var(--gym-gold)]">→</span>
          </>
        ) : null}
        <span className="font-metric text-[40px] leading-none text-[var(--gym-gold-bright)] [text-shadow:0_0_16px_rgba(246,227,161,0.35)]">
          {after}
        </span>
        <span className="text-[12px] text-[var(--gym-text-secondary)]">
          / {goalMinutes} min
        </span>
      </p>

      <div
        className="relative mt-2.5 h-2.5 rounded-full bg-[var(--gym-track)]"
        role="progressbar"
        aria-valuenow={Math.min(after, goalMinutes)}
        aria-valuemin={0}
        aria-valuemax={goalMinutes}
        aria-label={`Postęp cardio: ${after} z ${goalMinutes} minut`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold)] motion-reduce:transition-none"
          style={{
            width: `${oldPct}%`,
            transition: `width 500ms ${EASE}`,
            borderRadius: added > 0 ? undefined : "9999px",
          }}
        />
        <div
          className="absolute inset-y-0 rounded-r-full bg-gradient-to-r from-[#f6e3a1] to-[#fff3c4] shadow-[0_0_12px_rgba(246,227,161,0.7)] motion-reduce:transition-none"
          style={{
            left: `${oldPct}%`,
            width: `${newPct}%`,
            transition: `left 500ms ${EASE}, width 500ms ${EASE}`,
          }}
        />
        {goalMinutes > 0 ? (
          <div
            className="absolute -inset-y-1 w-0.5 rounded-full bg-white/85 motion-reduce:transition-none"
            style={{ left: `${goalPct}%`, transition: `left 500ms ${EASE}` }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[var(--gym-text-secondary)]">
        <span>
          {reached
            ? over > 0
              ? `Cel osiągnięty · +${over} min ponad cel`
              : "Cel osiągnięty"
            : `Do celu brakuje ${goalMinutes - after} min`}
        </span>
        <span>cel {goalMinutes}</span>
      </div>
      {minutesCompleted === 0 && added === 0 ? (
        <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
          To pierwszy wpis w tym tygodniu.
        </p>
      ) : null}
    </div>
  );
}

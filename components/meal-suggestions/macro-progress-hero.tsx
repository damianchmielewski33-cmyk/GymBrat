"use client";

import { motion } from "framer-motion";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { cn } from "@/lib/utils";

const HERO_GOLD = "var(--gym-gold)";
const HERO_GOLD_RGB = "221, 187, 109";

const springSoft = { type: "spring" as const, stiffness: 380, damping: 28 };

export type MacroAmount = {
  consumed: number;
  goal: number | null;
};

export type MacroProgressHeroProps = {
  /** Np. „Zjedzone” (Dziennik) albo „Dziś zostało” (Przepisy). */
  label: string;
  calories: MacroAmount;
  protein: MacroAmount;
  carbs: MacroAmount;
  fat: MacroAmount;
  /**
   * `eaten` — pierścień i liczby = zjedzone / cel (Dziennik).
   * `remaining` — środek i wiersze B/W/T = zostało (cel − zjedzone); pierścień nadal postęp dnia.
   */
  mode?: "eaten" | "remaining";
  /** Opóźnienie wejścia animacji (sekundy). */
  enterDelay?: number;
  className?: string;
};

/**
 * Wspólny hero makro (pierścień kcal + B/W/T).
 * Wygląd jak karta „Zjedzone” w Dzienniku — jedna matematyka SVG.
 */
export function MacroProgressHero({
  label,
  calories,
  protein,
  carbs,
  fat,
  mode = "eaten",
  enterDelay = 0.32,
  className,
}: MacroProgressHeroProps) {
  const kcalGoal = calories.goal;
  const kcalEaten = Math.round(calories.consumed);
  const kcalRemaining =
    kcalGoal != null ? Math.round(kcalGoal - kcalEaten) : null;
  const kcalDelta =
    kcalGoal != null ? Math.round(kcalEaten - kcalGoal) : null;
  const overGoal = kcalDelta != null && kcalDelta > 0;
  const kcalPct =
    kcalGoal != null && kcalGoal > 0
      ? Math.min(100, Math.round((kcalEaten / kcalGoal) * 100))
      : 0;

  const kcalCenter =
    mode === "remaining"
      ? overGoal
        ? Math.abs(kcalRemaining ?? 0)
        : Math.max(0, kcalRemaining ?? 0)
      : kcalEaten;

  const macroRows = [
    {
      key: "B",
      label: "Białko",
      consumed: Math.round(protein.consumed),
      goal: protein.goal,
      color: "#F2DC95",
      kcalPerG: 4,
    },
    {
      key: "W",
      label: "Węgle",
      consumed: Math.round(carbs.consumed),
      goal: carbs.goal,
      color: "#D1A84A",
      kcalPerG: 4,
    },
    {
      key: "T",
      label: "Tłuszcze",
      consumed: Math.round(fat.consumed),
      goal: fat.goal,
      color: "#8A6A2C",
      kcalPerG: 9,
    },
  ] as const;

  // Udział %: z zjedzonych; gdy pusto — z celów (jak w Dzienniku).
  const eatenKcalByMacro = macroRows.map((r) => r.consumed * r.kcalPerG);
  const goalKcalByMacro = macroRows.map((r) => (r.goal ?? 0) * r.kcalPerG);
  const shareBase =
    eatenKcalByMacro.reduce((a, b) => a + b, 0) > 0
      ? eatenKcalByMacro
      : goalKcalByMacro;
  const shareTotal = shareBase.reduce((a, b) => a + b, 0);
  const macroShare = shareBase.map((v) =>
    shareTotal > 0 ? Math.round((v / shareTotal) * 100) : null,
  );

  const gradientId = `macro-ring-gold-${mode}-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 36 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: enterDelay }}
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-white/[0.08] px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
      style={{
        background: `
          radial-gradient(120% 90% at 50% -10%, rgba(${HERO_GOLD_RGB}, 0.16) 0%, transparent 55%),
          radial-gradient(80% 60% at 100% 100%, rgba(${HERO_GOLD_RGB}, 0.06) 0%, transparent 50%),
          #0A0A0A
        `,
        boxShadow: `
          0 0 0 1px rgba(${HERO_GOLD_RGB}, 0.08),
          0 0 48px rgba(${HERO_GOLD_RGB}, 0.07),
          inset 0 1px 0 rgba(255,255,255,0.06)
        `,
      }}
    >
      <div
        aria-hidden
        className="diary-macro-sheen pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="relative flex items-center justify-between gap-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: HERO_GOLD }}
        >
          {label}
        </p>
        {kcalGoal != null ? (
          <p
            className={cn(
              "truncate text-[11px] tabular-nums tracking-tight",
              overGoal ? "text-rose-300/90" : "text-white/45",
            )}
          >
            {mode === "remaining"
              ? `cel ${Math.round(kcalGoal)}`
              : kcalRemaining != null && !overGoal
                ? `zostało ${Math.max(0, kcalRemaining)} · cel ${Math.round(kcalGoal)}`
                : `cel ${Math.round(kcalGoal)}${
                    kcalDelta != null
                      ? ` · ${kcalDelta > 0 ? "+" : ""}${kcalDelta}`
                      : ""
                  }`}
          </p>
        ) : (
          <p className="truncate text-[11px] text-white/40">
            Ustaw cel w profilu
          </p>
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-4 sm:gap-6">
        <div className="relative h-[116px] w-[116px] shrink-0 sm:h-[132px] sm:w-[132px]">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F5E4A3" />
                <stop offset="55%" stopColor="var(--gym-gold)" />
                <stop offset="100%" stopColor="#B88A32" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="9"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={overGoal ? "#FB7185" : `url(#${gradientId})`}
              strokeWidth="9"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: kcalPct / 100 }}
              transition={{
                duration: 0.9,
                ease: [0.22, 1, 0.36, 1],
                delay: enterDelay + 0.08,
              }}
              style={{
                filter: `drop-shadow(0 0 6px rgba(${HERO_GOLD_RGB}, 0.35))`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center font-metric tabular-nums">
            <p
              className={cn(
                "text-[clamp(1.6rem,6.5vw,2.1rem)] font-semibold leading-none tracking-tight",
                overGoal ? "text-rose-300" : "text-[#F4EEDD]",
              )}
            >
              <AnimatedMetric
                value={kcalCenter}
                durationMs={700}
                className="text-[clamp(1.6rem,6.5vw,2.1rem)] leading-none"
              />
            </p>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
              {mode === "remaining" && kcalGoal != null
                ? `/ ${Math.round(kcalGoal)} kcal`
                : "kcal"}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3 font-metric tabular-nums">
          {macroRows.map((row) => {
            const pct =
              row.goal != null && row.goal > 0
                ? Math.min(100, (row.consumed / row.goal) * 100)
                : 0;
            const over = row.goal != null && row.consumed > row.goal;
            const remaining =
              row.goal != null ? Math.round(row.goal - row.consumed) : null;
            return (
              <div key={row.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className="flex min-w-0 items-center gap-2 truncate text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: HERO_GOLD }}
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </p>
                  {mode === "remaining" ? (
                    <p
                      className={cn(
                        "shrink-0 text-[13px] font-semibold leading-none sm:text-[15px]",
                        over ? "text-rose-300" : "text-white",
                      )}
                    >
                      {remaining != null ? (
                        over ? (
                          <>
                            +{Math.abs(remaining)}{" "}
                            <span className="text-[11px] font-medium text-white/40">
                              g nad
                            </span>
                          </>
                        ) : (
                          <>
                            zostało{" "}
                            <AnimatedMetric
                              value={Math.max(0, remaining)}
                              durationMs={700}
                              className="text-[13px] leading-none sm:text-[15px]"
                            />
                            <span className="ml-1 text-[11px] font-medium text-white/40">
                              g
                            </span>
                          </>
                        )
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </p>
                  ) : (
                    <p
                      className={cn(
                        "shrink-0 text-[17px] font-semibold leading-none sm:text-[19px]",
                        over ? "text-rose-300" : "text-white",
                      )}
                    >
                      <AnimatedMetric
                        value={row.consumed}
                        durationMs={700}
                        className="text-[17px] leading-none sm:text-[19px]"
                      />
                      {row.goal != null ? (
                        <span className="text-[11px] font-medium text-white/35">
                          {" "}
                          / {Math.round(row.goal)}
                        </span>
                      ) : null}
                      <span className="ml-1 text-[11px] font-medium text-white/40">
                        g
                      </span>
                    </p>
                  )}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: over ? "#FB7185" : row.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.7,
                      ease: [0.22, 1, 0.36, 1],
                      delay: enterDelay + 0.13,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3 text-[11px] tabular-nums text-white/45">
        {macroRows.map((row, i) => (
          <p
            key={row.key}
            className={cn(
              "truncate",
              i === 1 && "text-center",
              i === 2 && "text-right",
            )}
          >
            {row.label}{" "}
            <span className="font-semibold text-white/85">
              {macroShare[i] != null ? `${macroShare[i]}%` : "—"}
            </span>
          </p>
        ))}
      </div>
    </motion.section>
  );
}

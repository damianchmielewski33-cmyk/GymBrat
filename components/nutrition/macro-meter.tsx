import { Meter } from "@/components/progress/progress-ui";
import {
  formatPlNumber,
  type MacroBalance,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

export function MacroMeter({
  macro,
  showTodayNote,
}: {
  macro: MacroBalance;
  showTodayNote?: boolean;
}) {
  const goal = macro.goal;
  const none = goal == null;
  const pct = macro.adherencePct ?? 0;
  const todayGoal = macro.goalToday ?? 0;
  const totalGoal = goal ?? 0;
  const closedPct =
    totalGoal > 0 ? ((macro.consumedClosed ?? 0) / totalGoal) * 100 : 0;
  const todayPct =
    totalGoal > 0 ? ((macro.consumedToday ?? 0) / totalGoal) * 100 : 0;
  const useSegments = (macro.consumedToday ?? 0) > 0 || todayGoal > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          {macro.key === "calories"
            ? "KALORIE"
            : macro.key === "protein"
              ? "BIAŁKO"
              : macro.key === "carbs"
                ? "WĘGLE"
                : "TŁUSZCZ"}
        </p>
        <div className="flex items-baseline gap-2 tabular-nums">
          <p className="text-[13px] font-semibold text-white/90">
            {formatPlNumber(macro.consumed)}
            {goal != null ? ` / ${formatPlNumber(goal)}` : ""} {macro.unit}
          </p>
          {macro.adherencePct != null ? (
            <p className="text-[14px] font-semibold text-white">
              {macro.adherencePct}%
            </p>
          ) : null}
        </div>
      </div>
      <Meter
        size="md"
        pct={pct}
        overflow={pct > 100}
        none={none}
        segments={
          useSegments && !none
            ? { closedPct, todayPct }
            : undefined
        }
        aria-valuetext={
          none
            ? `${macro.label}: ${Math.round(macro.consumed)} ${macro.unit}, brak celu`
            : `${macro.label}: ${Math.round(macro.consumed)} z ${Math.round(goal!)} ${macro.unit}, ${macro.adherencePct}% celu`
        }
      />
      {showTodayNote && (macro.consumedToday ?? 0) > 0 ? (
        <p
          className={cn(
            "text-[12px] tabular-nums text-[var(--gym-text-secondary)]",
          )}
        >
          w tym dziś w toku: {formatPlNumber(macro.consumedToday!)}{" "}
          {macro.unit}
        </p>
      ) : null}
    </div>
  );
}

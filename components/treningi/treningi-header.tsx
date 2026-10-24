import { AppPageHeader } from "@/components/layout/screen";
import {
  formatStreakWeeks,
  formatStreakWeeksAria,
  formatWeekRange,
  formatWeekRangeAria,
} from "@/lib/treningi-hub-format";

export function TreningiHeader({
  weekStartKey,
  weekEndKey,
  streakWeeks,
}: {
  weekStartKey: string;
  weekEndKey: string;
  streakWeeks: number;
}) {
  const streak = formatStreakWeeks(streakWeeks);

  return (
    <AppPageHeader
      title="Trening"
      className="compact:pt-0"
      description={
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {/* aria-label na <span> bez roli czytniki pomijają; pełna forma w sr-only. */}
          <span className="tabular-nums text-white/65">
            <span aria-hidden>{formatWeekRange(weekStartKey, weekEndKey)}</span>
            <span className="sr-only">
              {formatWeekRangeAria(weekStartKey, weekEndKey)}
            </span>
          </span>
          {streak ? (
            <span
              className="inline-flex h-7 items-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/[0.08] px-3 text-[12px] font-semibold tabular-nums text-[var(--gym-gold)]"
            >
              <span aria-hidden>{streak}</span>
              <span className="sr-only">{formatStreakWeeksAria(streakWeeks)}</span>
            </span>
          ) : null}
        </div>
      }
    />
  );
}

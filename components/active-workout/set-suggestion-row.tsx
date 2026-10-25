import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Equal } from "lucide-react";
import type { WorkoutSetState } from "@/components/workout/types";
import {
  DEFAULT_SUGGESTION_REASON,
  type SetSuggestionView,
  type SuggestionDirection,
} from "@/lib/set-suggestion-view";
import {
  formatDaysAgo,
  formatSignedKg,
  formatWeightReps,
} from "@/lib/active-workout-copy";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { cn } from "@/lib/utils";

const DIRECTION_STYLE: Record<
  SuggestionDirection,
  { chip: string; text: string; word: string; Icon: typeof ArrowUp }
> = {
  up: {
    chip: "border-[var(--gym-trend-up)]/50 bg-[var(--gym-trend-up)]/12",
    text: "text-[var(--gym-trend-up)]",
    word: "więcej",
    Icon: ArrowUp,
  },
  down: {
    chip: "border-[var(--gym-trend-down)]/65 bg-[var(--gym-trend-down)]/10",
    text: "text-[var(--gym-trend-down)]",
    word: "lżej",
    Icon: ArrowDown,
  },
  hold: {
    chip: "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/10",
    text: "text-[var(--gym-gold)]",
    word: "ten sam ciężar",
    Icon: Equal,
  },
};

function hasHistory(set: WorkoutSetState | null): set is WorkoutSetState {
  return set != null && (set.weight > 0 || (set.reps != null && set.reps > 0));
}

function lastSetText(set: WorkoutSetState): string {
  if (set.weight > 0) return formatWeightReps(set.weight, set.reps);
  return `${set.reps} powt.`;
}

function lastSetSpoken(set: WorkoutSetState, when: string | null): string {
  const parts: string[] = [];
  if (set.weight > 0) parts.push(`${formatKgPl(set.weight)} kg`);
  if (set.reps != null && set.reps > 0) parts.push(`${set.reps} powtórzeń`);
  if (when) parts.push(when);
  return parts.join(", ");
}

function suggestionSpoken(s: SetSuggestionView): string {
  const reps = s.reps != null ? `, ${s.reps} powtórzeń` : "";
  return `Sugestia: ${DIRECTION_STYLE[s.direction].word}, ${formatKgPl(s.weightKg)} kg${reps}`;
}

/** Linia 2: różnica w kolorze kierunku + neutralny powód (LR-4, LR-5). */
function ReasonLine({ suggestion }: { suggestion: SetSuggestionView }) {
  const reason = suggestion.reason ?? DEFAULT_SUGGESTION_REASON;
  if (suggestion.referenceKg == null) return <>{reason}</>;
  if (suggestion.direction === "hold") return <>ten sam ciężar · {reason}</>;
  return (
    <>
      <span className={cn("font-semibold", DIRECTION_STYLE[suggestion.direction].text)}>
        {formatSignedKg(suggestion.deltaKg)}
      </span>{" "}
      · {reason}
    </>
  );
}

function SuggestionChipContent({
  suggestion,
  applied,
}: {
  suggestion: SetSuggestionView;
  applied: boolean;
}) {
  const style = DIRECTION_STYLE[suggestion.direction];
  const { Icon } = style;
  return (
    <>
      <span className={cn("inline-flex items-center gap-1", style.text)}>
        <Icon className="size-4" strokeWidth={2.25} />
        {formatKgPl(suggestion.weightKg)}
      </span>
      {suggestion.reps != null ? <span>× {suggestion.reps}</span> : null}
      {applied ? (
        <Check className="size-3 text-[var(--gym-gold-bright)]" strokeWidth={3} />
      ) : null}
    </>
  );
}

const chipBase =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold tabular-nums text-white";

/**
 * Jeden wiersz „Ostatnio + sugestia” (ekran serii i „Następnie” na przerwie).
 * Bez `onApplyLast` / `onApplySuggestion` wiersz jest tylko do odczytu.
 */
export function SetSuggestionRow({
  suggestion,
  lastSet,
  daysSinceLastSession,
  applied = false,
  onApplyLast,
  onApplySuggestion,
  className,
}: {
  suggestion: SetSuggestionView | null;
  lastSet: WorkoutSetState | null;
  daysSinceLastSession?: number | null;
  /** Pola mają wartości sugestii. */
  applied?: boolean;
  onApplyLast?: () => void;
  onApplySuggestion?: () => void;
  className?: string;
}) {
  const history = hasHistory(lastSet) ? lastSet : null;
  const when = formatDaysAgo(daysSinceLastSession);

  let line1: ReactNode;
  let line2: ReactNode = null;
  if (history) {
    line1 = (
      <>
        Ostatnio {lastSetText(history)}
        {when ? (
          <span className="text-[var(--gym-text-secondary)]"> · {when}</span>
        ) : null}
      </>
    );
    if (suggestion) line2 = <ReasonLine suggestion={suggestion} />;
    else if (onApplyLast) line2 = "Dotknij, aby wstawić";
  } else if (suggestion) {
    line1 = "Sugestia na tę serię";
    line2 = <ReasonLine suggestion={suggestion} />;
  } else {
    line1 = "Pierwsza seria tego ćwiczenia";
    line2 = "Wpisz ciężar, z którym zaczynasz";
  }

  const text = (
    <>
      <span className="block truncate text-[13px] leading-[17px] text-white tabular-nums compact:text-[12px] compact:leading-[15px]">
        {line1}
      </span>
      {line2 ? (
        <span className="line-clamp-2 text-pretty text-[12px] leading-4 text-[var(--gym-text-secondary)] tabular-nums compact:text-[11px] compact:leading-[14px]">
          {line2}
        </span>
      ) : null}
    </>
  );

  const leftClass =
    "flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left";

  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-2 rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] py-1.5 pl-3 pr-1.5 compact:min-h-11 compact:py-0.5",
        className,
      )}
    >
      {history && onApplyLast ? (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onApplyLast}
          aria-label={`Wstaw wartości z ostatniego treningu: ${lastSetSpoken(history, when)}`}
          className={cn(leftClass, "rounded-xl")}
        >
          {text}
        </button>
      ) : (
        <div className={leftClass}>{text}</div>
      )}

      {suggestion ? (
        onApplySuggestion ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onApplySuggestion}
            aria-pressed={applied}
            aria-label={`${suggestionSpoken(suggestion)}. ${applied ? "Wstawiono" : "Wstaw"}`}
            className={cn(chipBase, DIRECTION_STYLE[suggestion.direction].chip)}
          >
            <SuggestionChipContent suggestion={suggestion} applied={applied} />
          </button>
        ) : (
          <span className={cn(chipBase, DIRECTION_STYLE[suggestion.direction].chip)}>
            <span className="sr-only">{suggestionSpoken(suggestion)}</span>
            <span aria-hidden className="inline-flex items-center gap-1.5">
              <SuggestionChipContent suggestion={suggestion} applied={false} />
            </span>
          </span>
        )
      ) : null}
    </div>
  );
}

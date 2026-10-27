import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Meter } from "@/components/progress/progress-ui";
import {
  formatPlNumber,
  type MacroBalance,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

function statusLine(macro: MacroBalance, inProgress: boolean): {
  text: string;
  tone: "gold" | "white" | "muted";
  Icon: typeof ArrowDownRight | typeof ArrowUpRight | typeof Minus | null;
} {
  if (macro.goal == null) {
    return { text: "brak celu", tone: "muted", Icon: Minus };
  }
  if (macro.direction === "over") {
    const n = Math.abs(Math.round(macro.delta ?? 0));
    return {
      text: `ponad cel o ${formatPlNumber(n)} ${macro.unit}`,
      tone: "white",
      Icon: ArrowUpRight,
    };
  }
  const left = Math.round(macro.remaining ?? 0);
  if (inProgress) {
    return {
      text: `do celu ${formatPlNumber(left)} ${macro.unit}`,
      tone: "gold",
      Icon: ArrowDownRight,
    };
  }
  if (macro.direction === "under") {
    return {
      text: `brakuje ${formatPlNumber(left)} ${macro.unit}`,
      tone: "gold",
      Icon: ArrowDownRight,
    };
  }
  return { text: "w normie", tone: "gold", Icon: null };
}

export function MacroTodayTile({
  macro,
  inProgress,
  variant = "tile",
  emptyDay,
}: {
  macro: MacroBalance;
  inProgress: boolean;
  variant?: "tile" | "hero";
  emptyDay?: boolean;
}) {
  const status = statusLine(macro, inProgress);
  const pct = macro.adherencePct;
  const over = pct != null && pct > 100;
  const none = macro.goal == null;

  if (variant === "hero") {
    const right =
      macro.goal == null ? (
        <p className="text-[14px] text-[var(--gym-text-secondary)]">
          Brak celu kalorii
        </p>
      ) : macro.direction === "over" ? (
        <p className="inline-flex items-center gap-1 text-[14px] text-white/90">
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          ponad cel o {formatPlNumber(Math.abs(Math.round(macro.delta ?? 0)))}{" "}
          kcal
        </p>
      ) : emptyDay ? (
        <p className="text-[14px] text-[var(--gym-gold)]">Brak wpisów dziś</p>
      ) : (
        <p className="text-[14px] text-[var(--gym-gold)]">
          {formatPlNumber(Math.round(macro.remaining ?? 0))} kcal do celu
        </p>
      );

    return (
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-metric text-[40px] leading-none tabular-nums text-[var(--gym-gold)] sm:text-[44px]">
              {formatPlNumber(macro.consumed)}
              <span className="ml-1 text-[16px] font-semibold text-white/90">
                kcal
              </span>
            </p>
            {macro.goal != null ? (
              <p className="mt-1 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                z {formatPlNumber(macro.goal)} kcal
              </p>
            ) : null}
          </div>
          {right}
        </div>
        <Meter
          size="lg"
          pct={pct ?? 0}
          overflow={over}
          none={none}
          aria-valuetext={
            none
              ? `Kalorie: ${Math.round(macro.consumed)} kilokalorii, brak celu`
              : `Kalorie: ${Math.round(macro.consumed)} z ${Math.round(macro.goal!)} kilokalorii, ${pct ?? 0} procent celu`
          }
        />
      </div>
    );
  }

  const Icon = status.Icon;
  return (
    <div className="rounded-2xl border border-[var(--gym-border-gold)] bg-black/25 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
        {macro.key === "protein"
          ? "BIAŁKO"
          : macro.key === "carbs"
            ? "WĘGLE"
            : "TŁUSZCZ"}
      </p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-white sm:text-[20px]">
        {formatPlNumber(macro.consumed)} g
      </p>
      {macro.goal != null ? (
        <p className="text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
          z {formatPlNumber(macro.goal)} g
        </p>
      ) : (
        <p className="text-[12px] text-[var(--gym-text-secondary)]"> </p>
      )}
      <div className="mt-2">
        <Meter
          size="sm"
          pct={emptyDay ? 0 : (pct ?? 0)}
          overflow={over}
          none={none}
          aria-valuetext={`${macro.label}: ${Math.round(macro.consumed)}${macro.goal != null ? ` z ${Math.round(macro.goal)}` : ""} ${macro.unit}`}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 flex items-center gap-0.5 text-[12px]",
          status.tone === "gold" && "text-[var(--gym-gold)]",
          status.tone === "white" && "text-white/90",
          status.tone === "muted" && "text-[var(--gym-text-secondary)]",
        )}
      >
        {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
        <span className="leading-tight">{status.text}</span>
      </p>
    </div>
  );
}

"use client";

import {
  HOF_PERIOD_KINDS,
  HOF_PERIOD_LABELS,
  type HofPeriodKind,
} from "@/lib/community/hof-types";

export function HofPeriodTabs({
  kind,
  onChange,
}: {
  kind: HofPeriodKind;
  onChange: (k: HofPeriodKind) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Okres Galerii sławy"
    >
      {HOF_PERIOD_KINDS.map((k) => {
        const active = k === kind;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            className={
              active
                ? "rounded-full border border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/20 px-3.5 py-2 text-[12px] font-medium text-[var(--gym-gold)]"
                : "rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] text-white/55 transition hover:border-white/25 hover:text-white"
            }
          >
            {HOF_PERIOD_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}

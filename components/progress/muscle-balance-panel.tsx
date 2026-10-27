"use client";

import {
  Meter,
  ProgressSection,
  Surface,
} from "@/components/progress/progress-ui";
import type { MuscleBalanceSnapshot } from "@/lib/analytics";

/** Rozkład serii według partii w wybranym oknie. */
export function MuscleBalancePanel({
  muscle,
}: {
  muscle: MuscleBalanceSnapshot;
}) {
  const topGroups = [...muscle.groups]
    .sort((a, b) => b.days30.sets - a.days30.sets);
  const maxShare = Math.max(1, ...topGroups.map((g) => g.days30.sharePct));

  return (
    <ProgressSection title="Balans partii" trailing="30 dni">
      <Surface className="space-y-3">
        <ul className="space-y-2">
            {topGroups.map((g) => (
              <li key={g.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-white">
                    {g.label}
                  </span>
                  <span className="text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                    <span className="font-metric text-white">{g.days30.sets}</span>{" "}
                    serii · {g.days30.sharePct}%
                  </span>
                </div>
                <Meter pct={(g.days30.sharePct / maxShare) * 100} />
              </li>
            ))}
        </ul>

        {muscle.alerts[0] ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-white/85">
            {muscle.alerts[0].message}
          </p>
        ) : null}
      </Surface>
    </ProgressSection>
  );
}

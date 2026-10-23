"use client";

import {
  EmptyNote,
  Eyebrow,
  Meter,
  ProgressSection,
  Surface,
} from "@/components/progress/progress-ui";
import type { MuscleBalanceSnapshot, StagnationItem } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Balans mięśniowy + stagnacja w jednej karcie (wcześniej dwie sekcje 01 / 02). */
export function MuscleBalancePanel({
  muscle,
  stagnation,
}: {
  muscle: MuscleBalanceSnapshot;
  stagnation: StagnationItem[];
}) {
  const topGroups = [...muscle.groups]
    .filter((g) => g.days30.sets > 0)
    .sort((a, b) => b.days30.sets - a.days30.sets);
  const maxShare = Math.max(1, ...topGroups.map((g) => g.days30.sharePct));

  const stagnTop = stagnation
    .filter((s) => s.status === "stagnating" || s.status === "regressing")
    .slice(0, 3);

  if (topGroups.length === 0 && stagnTop.length === 0) {
    return (
      <ProgressSection title="Balans mięśniowy" trailing="30 dni">
        <EmptyNote>Zaliczone serie pojawią się tu jako objętość na partię.</EmptyNote>
      </ProgressSection>
    );
  }

  return (
    <ProgressSection title="Balans mięśniowy" trailing="30 dni">
      <Surface className="space-y-3">
        {topGroups.length > 0 ? (
          <ul className="space-y-2">
            {topGroups.map((g) => (
              <li key={g.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white/90">
                    {g.label}
                  </span>
                  <span className="text-[12px] tabular-nums text-white/55">
                    <span className="font-metric text-white">{g.days30.sets}</span>{" "}
                    serii · {g.days30.sharePct}%
                  </span>
                </div>
                <Meter pct={(g.days30.sharePct / maxShare) * 100} />
              </li>
            ))}
          </ul>
        ) : null}

        {muscle.alerts[0] ? (
          <p className="text-[12px] leading-snug text-amber-200/90">
            {muscle.alerts[0].message}
          </p>
        ) : null}

        {stagnTop.length > 0 ? (
          <div className="space-y-1 border-t border-white/[0.06] pt-2.5">
            <Eyebrow>Stagnacja</Eyebrow>
            <ul className="divide-y divide-white/[0.06]">
              {stagnTop.map((s) => (
                <li
                  key={s.exerciseKey}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {s.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      Brak postępu od {s.daysWithoutProgress} dni
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      s.status === "regressing"
                        ? "bg-rose-400/15 text-rose-300"
                        : "bg-amber-400/15 text-amber-200",
                    )}
                  >
                    {s.statusLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Surface>
    </ProgressSection>
  );
}

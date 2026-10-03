import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import type { ProgressHubData } from "@/lib/progress-hub";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

function TrendIcon({ trend }: { trend: "up" | "flat" | "down" }) {
  if (trend === "up")
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
  if (trend === "down")
    return <TrendingDown className="h-3.5 w-3.5 text-rose-400" aria-hidden />;
  return <Minus className="h-3.5 w-3.5 text-white/35" aria-hidden />;
}

function formatShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

export function StrengthTab({ data }: { data: ProgressHubData["strength"] }) {
  const { maxes, volumeSessions, volumeCounts, planGroups } = data;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <SectionLabel title="Moje maxy" trailing={`${maxes.length}`} />
        {maxes.length === 0 ? (
          <div className="app-card px-4 py-8 text-center text-sm text-white/45">
            Zaliczone serie z ciężarem pojawią się tutaj jako maxy e1RM.
          </div>
        ) : (
          <ul className="space-y-2">
            {maxes.map((m) => (
              <li key={m.name}>
                <Link
                  href={`/progress/exercises/${exerciseProgressKey(m.name)}`}
                  className="app-card flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {m.name}
                      </p>
                      {m.isNew ? (
                        <span className="shrink-0 rounded-md bg-[var(--gym-gold)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--gym-gold)]">
                          + Nowy max
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {m.bestWeight} kg × {m.bestReps} · {formatShort(m.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <AnimatedMetric
                      value={m.bestE1rm}
                      decimals={1}
                      className="text-xl text-white"
                    />
                    <p className="text-[10px] uppercase tracking-wider text-white/35">
                      e1RM
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionLabel index="01" title="Objętość" trailing="ostatnie 6" />
        <div className="app-card space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Rośnie", volumeCounts.up, "text-emerald-400"],
                ["Stoi", volumeCounts.flat, "text-white/55"],
                ["Spada", volumeCounts.down, "text-rose-400"],
              ] as const
            ).map(([label, n, tone]) => (
              <div
                key={label}
                className="rounded-xl border border-white/8 bg-black/20 px-2 py-2.5 text-center"
              >
                <p className={cn("font-metric text-2xl tabular-nums", tone)}>
                  <AnimatedMetric value={n} className={tone} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {label}
                </p>
              </div>
            ))}
          </div>
          {volumeSessions.length === 0 ? (
            <p className="text-center text-xs text-white/40">
              Brak treningów siłowych do porównania.
            </p>
          ) : (
            <ul className="space-y-2">
              {volumeSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white/85">{s.title}</p>
                    <p className="text-[11px] text-white/40">
                      {formatShort(s.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={s.trend} />
                    <span className="font-metric text-base tabular-nums text-white">
                      {s.volumeKg.toLocaleString("pl-PL")}
                      <span className="ml-1 text-[11px] text-white/35">kg</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index="02" title="Ćwiczenia" />
        {planGroups.length === 0 ? (
          <div className="app-card px-4 py-8 text-center text-sm text-white/45">
            Ustaw plan treningowy albo zalicz pierwsze serie.
          </div>
        ) : (
          planGroups.map((group) => (
            <div key={group.planId} className="space-y-2">
              <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {group.planName}
              </p>
              <ul className="space-y-1.5">
                {group.exercises.map((ex) => (
                  <li key={`${group.planId}-${ex.name}`}>
                    <Link
                      href={`/progress/exercises/${exerciseProgressKey(ex.name)}`}
                      className="app-card flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{ex.name}</p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {ex.lastBestWeight > 0
                            ? `${ex.lastBestWeight} kg · `
                            : ""}
                          {ex.lastVolumeKg > 0
                            ? `${ex.lastVolumeKg.toLocaleString("pl-PL")} kg objętości`
                            : "brak danych"}
                        </p>
                      </div>
                      <div className="w-16 shrink-0">
                        <MiniSparkline
                          values={ex.spark.length >= 2 ? ex.spark : [0, 0]}
                          color={
                            ex.trend === "down"
                              ? "#fb7185"
                              : ex.trend === "up"
                                ? "#34d399"
                                : "#ebc44a"
                          }
                          className="h-8 w-full"
                        />
                      </div>
                      <TrendIcon trend={ex.trend} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

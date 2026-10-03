import Link from "next/link";
import { ChevronRight, Clock, TrendingUp } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import type { RecentWorkoutItem } from "@/lib/treningi-hub-stats";

function formatDayMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function relativeDayLabel(iso: string, today: string): string {
  if (iso === today) return "dziś";
  if (iso === addCalendarDays(today, -1)) return "wczoraj";
  return formatDayMonth(iso);
}

export function HomeRecentWorkouts({
  workouts,
}: {
  workouts: RecentWorkoutItem[];
}) {
  const today = calendarDateKey();
  const shown = workouts.slice(0, 4);

  return (
    <section className="space-y-3">
      <SectionLabel
        index={6}
        title="Ostatnie treningi"
        trailing={workouts.length > 0 ? String(workouts.length) : "—"}
      />

      <div className="app-card overflow-hidden">
        {shown.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/40">
            Brak zapisanych treningów — odpal pierwszą sesję z karty powyżej.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {shown.map((w) => {
              const meta = [
                relativeDayLabel(w.date, today),
                w.durationMinutes != null ? `${w.durationMinutes} min` : null,
                w.setsDone > 0
                  ? `${w.setsDone} ${
                      w.setsDone === 1
                        ? "seria"
                        : w.setsDone >= 2 && w.setsDone <= 4
                          ? "serie"
                          : "serii"
                    }`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={w.id}>
                  <Link
                    href={`/workout-history/${w.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="w-11 shrink-0 text-[12px] tabular-nums text-white/40">
                      {formatDayMonth(w.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-white">
                        {w.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-white/45">
                        {meta}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {w.volumeKg > 0 ? (
                        <span className="inline-flex items-baseline gap-1">
                          <AnimatedMetric
                            value={w.volumeKg}
                            className="text-[20px] leading-none text-white"
                          />
                          <span className="text-[11px] text-white/45">kg</span>
                        </span>
                      ) : (
                        <span className="font-metric text-[20px] text-white/35">
                          —
                        </span>
                      )}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-white/30"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
          <Link
            href="/workout-history"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <Clock className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Historia treningów
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                każda seria, poprawki do 7 dni
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
          <Link
            href="/progress"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
          >
            <TrendingUp
              className="h-4 w-4 shrink-0 text-[var(--gym-gold)]"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Postępy
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                siła, sylwetka, zdjęcia, tydzień
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

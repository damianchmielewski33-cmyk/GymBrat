import Link from "next/link";
import { Dumbbell, Zap } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatLast(ymd: string | null) {
  if (!ymd) return "Jeszcze nie trenowano";
  try {
    return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
      new Date(`${ymd}T12:00:00`),
    );
  } catch {
    return ymd;
  }
}

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-semibold tabular-nums text-white">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-medium text-white/45">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export function NextWorkoutTile({
  planName,
  exerciseCount,
  lastWorkoutDate,
  workoutsThisWeek,
  cardioThisWeekMinutes,
  workoutStreakDays,
}: {
  planName: string | null;
  exerciseCount: number;
  lastWorkoutDate: string | null;
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  workoutStreakDays: number;
}) {
  return (
    <section className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(900px_420px_at_10%_0%,rgba(255,45,85,0.14),transparent_55%)]" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-white/50">
              <Dumbbell className="h-4 w-4" aria-hidden />
              <p className="text-[11px] font-medium uppercase tracking-[0.22em]">
                Następny trening
              </p>
            </div>
            <h2 className="font-heading mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {planName ?? "Dodaj plan treningowy"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {planName
                ? `${exerciseCount} ćwiczeń · ostatnio: ${formatLast(lastWorkoutDate)}`
                : "Utwórz plan, żeby szybko rozpocząć sesję ze Startu."}
            </p>
          </div>
          <Link
            href={planName ? "/start-workout" : "/workout-plan"}
            className={cn(
              buttonVariants({ variant: "cta" }),
              "h-12 w-full shrink-0 sm:w-auto sm:min-w-[11rem]",
            )}
          >
            <Zap className="mr-2 h-4 w-4" aria-hidden />
            {planName ? "Rozpocznij" : "Utwórz plan"}
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <MiniStat label="Treningi w tygodniu" value={String(workoutsThisWeek)} />
          <MiniStat
            label="Cardio w tygodniu"
            value={String(Math.round(cardioThisWeekMinutes))}
            unit="min"
          />
          <MiniStat
            label="Treningi z rzędu"
            value={String(workoutStreakDays)}
          />
        </div>
      </div>
    </section>
  );
}

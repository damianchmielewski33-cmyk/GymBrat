import Link from "next/link";
import { Dumbbell, Flame, Timer, Zap } from "lucide-react";
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
  icon: Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: typeof Flame;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/40">
          {label}
        </p>
        <Icon className="h-3 w-3 shrink-0 text-white/30" aria-hidden />
      </div>
      <p className="mt-1 font-heading text-lg font-semibold tabular-nums text-white sm:text-xl">
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-medium text-white/45 sm:text-sm">
            {unit}
          </span>
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
    <section className="glass-panel neon-glow relative flex h-full flex-col overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(900px_420px_at_10%_0%,rgba(255,45,85,0.14),transparent_55%)]" />
      <div className="relative flex flex-1 flex-col gap-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-white/50">
              <Dumbbell className="h-4 w-4" aria-hidden />
              <p className="text-[11px] font-medium uppercase tracking-[0.22em]">
                Następny trening
              </p>
            </div>
            <h2 className="font-heading mt-1.5 text-2xl font-semibold text-white sm:text-[1.75rem]">
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
              "h-11 w-full shrink-0 sm:h-12 sm:w-auto sm:min-w-[10.5rem]",
            )}
          >
            <Zap className="mr-2 h-4 w-4" aria-hidden />
            {planName ? "Rozpocznij" : "Utwórz plan"}
          </Link>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2">
          <MiniStat
            icon={Dumbbell}
            label="Treningi / tydz."
            value={String(workoutsThisWeek)}
          />
          <MiniStat
            icon={Timer}
            label="Cardio / tydz."
            value={String(Math.round(cardioThisWeekMinutes))}
            unit="min"
          />
          <MiniStat
            icon={Flame}
            label="Seria dni"
            value={String(workoutStreakDays)}
          />
        </div>
      </div>
    </section>
  );
}

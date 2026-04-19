import { TrendingDown, TrendingUp, Minus, Dumbbell, RotateCcw, Clock } from "lucide-react";
import type { HomeStats } from "@/lib/home-stats";

function DeltaBadge({
  percent,
  absolute,
  unit,
}: {
  percent: number | null;
  absolute: number | null;
  unit: string;
}) {
  if (percent === null || absolute === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-white/40">
        <Minus className="h-3 w-3" />
        brak danych porównawczych
      </span>
    );
  }

  const isPositive = percent > 0;
  const isNeutral = percent === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-white/50">
        <Minus className="h-3 w-3" />
        bez zmian vs. średnia
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isPositive ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {isPositive ? "+" : ""}
      {percent}% ({isPositive ? "+" : ""}
      {absolute}&nbsp;{unit}) vs. średnia
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  deltaPercent,
  deltaAbsolute,
  deltaUnit,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  deltaPercent: number | null;
  deltaAbsolute: number | null;
  deltaUnit: string;
  gradient: string;
}) {
  return (
    <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
      <div
        className={`pointer-events-none absolute inset-0 opacity-40 ${gradient}`}
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2 text-white/50">
          {icon}
          <span className="text-[11px] font-medium uppercase tracking-[0.22em]">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-semibold text-white">
            {value.toLocaleString("pl-PL")}
          </span>
          <span className="text-sm text-white/50">{unit}</span>
        </div>
        <DeltaBadge
          percent={deltaPercent}
          absolute={deltaAbsolute}
          unit={deltaUnit}
        />
      </div>
    </div>
  );
}

function LastWorkoutMeta({
  title,
  date,
  durationMinutes,
}: {
  title: string;
  date: string;
  durationMinutes: number | null;
}) {
  const workoutDate = new Date(`${date}T12:00:00`);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  let timeAgo: string;
  if (diffDays === 0) timeAgo = "dzisiaj";
  else if (diffDays === 1) timeAgo = "wczoraj";
  else timeAgo = `${diffDays} dni temu`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/55">
      <span className="font-medium text-white/80">{title}</span>
      <span className="text-white/30">·</span>
      <span>{timeAgo}</span>
      {durationMinutes != null && durationMinutes > 0 && (
        <>
          <span className="text-white/30">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {durationMinutes} min
          </span>
        </>
      )}
    </div>
  );
}

export function LastWorkoutStats({ stats }: { stats: HomeStats }) {
  if (!stats.lastWorkout) {
    return (
      <div className="glass-panel p-6 text-center">
        <p className="text-sm text-white/50">
          Nie masz jeszcze żadnych treningów.{" "}
          <span className="text-white/70">Zacznij pierwszy trening!</span>
        </p>
      </div>
    );
  }

  const { lastWorkout } = stats;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/40">
          Ostatni trening
        </p>
        <LastWorkoutMeta
          title={lastWorkout.title}
          date={lastWorkout.date}
          durationMinutes={lastWorkout.durationMinutes}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Dumbbell className="h-4 w-4" />}
          label="Wolumen"
          value={lastWorkout.volumeKg}
          unit="kg"
          deltaPercent={stats.deltaVolumePercent}
          deltaAbsolute={stats.deltaVolumeKg}
          deltaUnit="kg"
          gradient="[background-image:linear-gradient(135deg,rgba(255,45,85,0.14),transparent_55%)]"
        />
        <StatCard
          icon={<RotateCcw className="h-4 w-4" />}
          label="Powtórzenia"
          value={lastWorkout.totalReps}
          unit="pow."
          deltaPercent={stats.deltaTotalRepsPercent}
          deltaAbsolute={stats.deltaTotalReps}
          deltaUnit="pow."
          gradient="[background-image:linear-gradient(225deg,rgba(120,120,255,0.14),transparent_55%)]"
        />
      </div>
    </div>
  );
}

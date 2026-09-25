import Link from "next/link";
import { ChevronDown, Play } from "lucide-react";

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
    <div className="px-1 py-1 text-center">
      <p className="app-label">{label}</p>
      <p className="app-value mt-2 text-2xl font-semibold leading-none">
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-medium text-white/40">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export function NextWorkoutTile({
  planName,
  exerciseCount,
  exerciseNames,
  firstTime,
  workoutsThisWeek,
  cardioThisWeekMinutes,
  workoutStreakDays,
}: {
  planName: string | null;
  exerciseCount: number;
  exerciseNames: string[];
  firstTime: boolean;
  lastWorkoutDate: string | null;
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  workoutStreakDays: number;
}) {
  const preview = exerciseNames.slice(0, 4).join(" · ");
  return (
    <section className="app-card space-y-5 p-5">
      <div>
        <p className="app-label">Następny trening</p>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight text-white">
          {planName ?? "Dodaj plan treningowy"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          {planName
            ? `${exerciseCount} ćwiczeń · ${
                firstTime ? "pierwszy raz w tym planie" : "kolejna sesja"
              }${preview ? ` · ${preview}${exerciseNames.length > 4 ? " · …" : ""}` : ""}`
            : "Utwórz plan, żeby szybko rozpocząć sesję ze Startu."}
        </p>
      </div>

      <Link
        href={planName ? "/start-workout" : "/workout-plan"}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--neon)] text-sm font-semibold text-[var(--neon-fg)]"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden />
        {planName ? "Zacznij trening" : "Utwórz plan"}
      </Link>

      {planName ? (
        <Link
          href="/workout-plan"
          className="flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40"
        >
          Inny dzień
          <ChevronDown className="h-3.5 w-3.5" />
        </Link>
      ) : null}

      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4">
        <MiniStat label="Treningi tyg." value={String(workoutsThisWeek)} />
        <MiniStat
          label="Cardio tyg."
          value={String(Math.round(cardioThisWeekMinutes))}
          unit="min"
        />
        <MiniStat label="Tyg. z rzędu" value={String(workoutStreakDays)} />
      </div>
    </section>
  );
}

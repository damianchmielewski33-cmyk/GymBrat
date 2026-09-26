import Link from "next/link";
import { ChevronDown, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function MiniStat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "gold" | "mint" | "sky";
}) {
  const toneClass =
    tone === "gold"
      ? "border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 text-[var(--gym-gold-bright)]"
      : tone === "mint"
        ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
        : "border-sky-400/35 bg-sky-400/10 text-sky-300";

  return (
    <div
      className={cn(
        "rounded-2xl border px-2 py-3 text-center",
        toneClass,
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold leading-none tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-medium opacity-70">{unit}</span>
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
  workoutStreakWeeks,
}: {
  planName: string | null;
  exerciseCount: number;
  exerciseNames: string[];
  firstTime: boolean;
  lastWorkoutDate: string | null;
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  /** Kolejne tygodnie kalendarzowe z ≥1 treningiem. */
  workoutStreakWeeks: number;
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
            : "Ustaw plan w Profilu, żeby szybko startować z Treningów."}
        </p>
      </div>

      <Link
        href={planName ? "/workout-plan" : "/profile/workout-plan"}
        className="gym-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
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
        <MiniStat
          label="Treningi tyg."
          value={String(workoutsThisWeek)}
          tone="gold"
        />
        <MiniStat
          label="Cardio tyg."
          value={String(Math.round(cardioThisWeekMinutes))}
          unit="min"
          tone="mint"
        />
        <MiniStat
          label="Tyg. z rzędu"
          value={String(workoutStreakWeeks)}
          tone="sky"
        />
      </div>
    </section>
  );
}

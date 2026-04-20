import Link from "next/link";
import { auth } from "@/auth";
import { getCompletedWorkoutsForUser, formatCompact } from "@/lib/workout-history";

function formatDate(ymd: string) {
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(d);
  } catch {
    return ymd;
  }
}

export default async function WorkoutHistoryPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const items = await getCompletedWorkoutsForUser(userId, { limit: 200 });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Trening
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Historia treningów
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Wszystkie zakończone treningi wraz ze szczegółami, miarami i porównaniem siły w ramach tego samego planu.
        </p>
      </header>

      <section className="glass-panel neon-glow overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Lista
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Zakończone sesje
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-white/55">
            Brak zakończonych treningów — ukończ pierwszy trening, aby zobaczyć historię.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((w) => (
                <li key={w.id} className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-white/45">
                        {formatDate(w.date)}
                      </p>
                      <p className="text-sm font-semibold text-white/90">{w.title}</p>
                      <p className="text-xs text-white/55">
                        Plan: {w.planName ?? "—"} • Objętość: {formatCompact(w.volumeKg)} • Siła:{" "}
                        {formatCompact(w.strengthScore)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/workout-history/${w.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/85 transition hover:bg-white/[0.07]"
                      >
                        Szczegóły
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}


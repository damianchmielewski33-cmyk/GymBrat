import Link from "next/link";
import { auth } from "@/auth";
import { getCompletedWorkoutsForUser, formatCompact } from "@/lib/workout-history";
import { ScreenHeader } from "@/components/layout/screen";
import { redirect } from "next/navigation";

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
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const items = await getCompletedWorkoutsForUser(userId, { limit: 200 });

  return (
    <div className="space-y-8">
      <ScreenHeader
        kicker="Trening"
        title="Historia treningów"
        description="Wszystkie zakończone treningi wraz ze szczegółami, miarami i porównaniem siły w ramach tego samego planu."
      />

      <section className="glass-panel neon-glow overflow-hidden">
        <div className="border-b border-white/10 px-4 py-4 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Lista
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Zakończone sesje
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-white/55 sm:px-6">
            Brak zakończonych treningów — ukończ pierwszy trening, aby zobaczyć historię.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((w) => (
                <li key={w.id} className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs uppercase tracking-wide text-white/45">
                        {formatDate(w.date)}
                      </p>
                      <p className="break-words text-sm font-semibold text-white/90">{w.title}</p>
                      <p className="hidden text-xs text-white/55 sm:block">
                        Plan: {w.planName ?? "—"} • Tonaż: {formatCompact(w.volumeKg)} • Wskaźnik
                        siły: {formatCompact(w.strengthScore)}
                      </p>
                      <div className="space-y-1 text-xs text-white/55 sm:hidden">
                        <p className="break-words">Plan: {w.planName ?? "—"}</p>
                        <p>
                          Tonaż: {formatCompact(w.volumeKg)} · Wskaźnik siły:{" "}
                          {formatCompact(w.strengthScore)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/workout-history/${w.id}`}
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
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


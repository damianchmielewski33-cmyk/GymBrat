import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  deltaPercent,
  formatCompact,
  formatPct,
  getCompletedWorkoutByIdForUser,
  getStrengthTrendForPlan,
} from "@/lib/workout-history";
import { redirect } from "next/navigation";

function formatDateTime(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return "—";
  }
}

function formatDate(ymd: string) {
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(d);
  } catch {
    return ymd;
  }
}

export default async function WorkoutHistoryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const w = await getCompletedWorkoutByIdForUser(userId, id);
  if (!w) return notFound();

  const trend =
    w.workoutPlanId != null ? await getStrengthTrendForPlan(userId, w.workoutPlanId, { limit: 30 }) : null;

  const points = trend?.points ?? [];
  const idx = points.findIndex((p) => p.date === w.date);
  const prev = idx > 0 ? points[idx - 1] : null;
  const deltaStrength = prev ? deltaPercent(w.strengthScore, prev.strengthScore) : null;
  const deltaVolume = prev ? deltaPercent(w.volumeKg, prev.volumeKg) : null;

  const last5 = points.slice(Math.max(0, points.length - 5));
  const first5 = points.slice(0, Math.min(points.length, 5));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const avgStrengthRecent = avg(last5.map((p) => p.strengthScore));
  const avgStrengthOld = avg(first5.map((p) => p.strengthScore));
  const deltaStrengthPeriod =
    avgStrengthRecent != null && avgStrengthOld != null ? deltaPercent(avgStrengthRecent, avgStrengthOld) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              {formatDate(w.date)}
            </p>
            <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
              {w.title}
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Plan: {w.planName ?? "—"} • Start: {formatDateTime(w.startedAt)} • Koniec: {formatDateTime(w.endedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/workout-history"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/85 transition hover:bg-white/[0.07]"
            >
              Wróć
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel neon-glow p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">Objętość</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(w.volumeKg)}</p>
          <p className="mt-1 text-xs text-white/55">Δ vs poprzedni (plan): {formatPct(deltaVolume)}</p>
        </div>
        <div className="glass-panel neon-glow p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">Wskaźnik siły</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(w.strengthScore)}</p>
          <p className="mt-1 text-xs text-white/55">Δ vs poprzedni (plan): {formatPct(deltaStrength)}</p>
        </div>
        <div className="glass-panel neon-glow p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">Trend siły</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatPct(deltaStrengthPeriod)}</p>
          <p className="mt-1 text-xs text-white/55">
            Porównanie średniej z ostatnich 5 do pierwszych 5 treningów (ten sam plan)
          </p>
        </div>
        <div className="glass-panel neon-glow p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">Ćwiczenia</p>
          <p className="mt-2 text-2xl font-semibold text-white">{String(w.exercises.length)}</p>
          <p className="mt-1 text-xs text-white/55">Najlepsza seria = najwyższy e1RM na ćwiczenie</p>
        </div>
      </section>

      <section className="glass-panel neon-glow overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Szczegóły
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Serie i miary
          </h2>
        </div>

        <ul className="divide-y divide-white/5">
          {w.exercises.map((ex) => (
            <li key={ex.id} className="p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white/90">{ex.name}</p>
                  <p className="text-xs text-white/55">
                    Objętość: {formatCompact(ex.volumeKg)} • Najlepszy e1RM: {formatCompact(ex.bestE1rm)}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[520px] w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-xs text-white/55">
                      <th className="py-2 pr-4 font-medium">Seria</th>
                      <th className="py-2 pr-4 font-medium">Powt.</th>
                      <th className="py-2 pr-4 font-medium">Kg</th>
                      <th className="py-2 pr-4 font-medium">e1RM</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-white/80">
                    {ex.sets.map((s, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-2 pr-4">{i + 1}</td>
                        <td className="py-2 pr-4">{s.reps ?? "—"}</td>
                        <td className="py-2 pr-4">{s.weight > 0 ? formatCompact(s.weight) : "—"}</td>
                        <td className="py-2 pr-4">{s.e1rm > 0 ? formatCompact(s.e1rm) : "—"}</td>
                        <td className="py-2 pr-4">
                          {s.done ? (
                            <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200">
                              zal.
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/55">
                              pom.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}


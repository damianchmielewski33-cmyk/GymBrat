import Link from "next/link";
import type { ExerciseLeaderboardRow } from "@/lib/progress-analysis";
import { cn } from "@/lib/utils";

function formatCompact(n: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(n);
}

function formatPct(v: number | null) {
  if (v == null || !Number.isFinite(v)) return null;
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${String(r).replace(".", ",")}%`;
}

function formatDate(ymd: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

export function ExerciseLeaderboard({
  rows,
}: {
  rows: ExerciseLeaderboardRow[];
}) {
  if (!rows.length) {
    return (
      <section className="app-card p-5">
        <p className="app-label text-[var(--gym-gold)]">Ćwiczenia</p>
        <h2 className="mt-1.5 text-base font-semibold text-white">
          Ranking obciążenia
        </h2>
        <p className="mt-3 text-sm text-white/45">
          Po kilku treningach zobaczysz tu porównanie ćwiczeń i zmianę vs poprzednia sesja.
        </p>
      </section>
    );
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <p className="app-label text-[var(--gym-gold)]">Ćwiczenia</p>
        <h2 className="mt-1.5 text-base font-semibold text-white">
          Ranking · 90 dni
        </h2>
        <p className="mt-1 text-xs text-white/40">
          Tonaż, e1RM i zmiana objętości względem poprzedniej sesji tego ruchu. Kliknij, by
          otworzyć wykres.
        </p>
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {rows.map((row, i) => {
          const delta = formatPct(row.volumeDeltaPercent);
          const tone =
            row.volumeDeltaPercent == null
              ? "muted"
              : row.volumeDeltaPercent > 0.5
                ? "up"
                : row.volumeDeltaPercent < -0.5
                  ? "down"
                  : "flat";
          return (
            <li key={row.name}>
              <Link
                href={`/progress-analysis?q=${encodeURIComponent(row.name)}`}
                className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] sm:px-5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/55">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{row.name}</p>
                    {delta ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums",
                          tone === "up" &&
                            "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
                          tone === "down" &&
                            "border-rose-400/25 bg-rose-400/10 text-rose-200",
                          tone === "flat" &&
                            "border-white/10 bg-white/[0.04] text-white/55",
                          tone === "muted" &&
                            "border-white/10 bg-white/[0.04] text-white/45",
                        )}
                      >
                        {delta}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    {row.sessions} sesji · ostatnio {formatDate(row.lastDate)}
                    {row.avgRir != null
                      ? ` · śr. RIR ${String(row.avgRir).replace(".", ",")}`
                      : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-white/35">Tonaż</p>
                      <p className="tabular-nums text-white/80">
                        {formatCompact(row.totalVolumeKg)}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/35">e1RM</p>
                      <p className="tabular-nums text-white/80">
                        {formatCompact(row.bestE1rm)}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/35">Max kg</p>
                      <p className="tabular-nums text-white/80">
                        {formatCompact(row.bestWeight)}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

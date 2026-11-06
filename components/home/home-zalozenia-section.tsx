"use client";

export type HomeComplianceSlot = "tak" | "nie" | null;

function label(pct: number): string {
  if (pct > 100) return "ponad cel";
  if (pct >= 100) return "cel wykonany";
  if (pct >= 80) return "na dobrej drodze";
  if (pct >= 50) return "w normie";
  return "do poprawy";
}

function Row({ name, pct }: { name: string; pct: number | null }) {
  const shown = pct == null ? null : Math.round(pct);
  const width = shown == null ? 0 : Math.min(100, Math.max(0, shown));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-white">{name}</span>
        <span className="text-white/60">
          {shown == null ? (
            "brak danych"
          ) : (
            <>
              <span className="text-white tabular-nums">{shown}%</span> · {label(shown)}
            </>
          )}
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label={`${name}: realizacja założeń`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
      >
        <div
          className={
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none " +
            (shown != null && shown > 100 ? "bg-orange-400" : "gym-meter-gold")
          }
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

/** Realizacja założeń paskami (zamiast pierścieni i kafli „Forma”). */
export function HomeZalozeniaSection({
  dietPct,
  trainingPct,
  cardioPct,
  reportCount,
}: {
  dietPct: number | null;
  trainingPct: number | null;
  cardioPct: number | null;
  reportCount: number;
  dietHistory?: HomeComplianceSlot[];
  trainingHistory?: HomeComplianceSlot[];
  cardioHistory?: HomeComplianceSlot[];
  formToday?: unknown;
}) {
  return (
    <section className="app-card p-5" aria-labelledby="home-zal-h">
      <h2 id="home-zal-h" className="text-[13px] font-semibold text-white/60">
        Realizacja założeń
      </h2>
      {reportCount === 0 && dietPct == null && trainingPct == null && cardioPct == null ? (
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Po pierwszym raporcie zobaczysz tu, jak realizujesz dietę, treningi i cardio.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <Row name="Dieta" pct={dietPct} />
          <Row name="Treningi" pct={trainingPct} />
          <Row name="Cardio" pct={cardioPct} />
        </div>
      )}
    </section>
  );
}

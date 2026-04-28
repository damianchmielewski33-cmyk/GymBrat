type WeeklyDeficitPanelData = {
  weekLabel: string;
  deficitKcal: number | null;
  weightKg: number | null;
};

const KCAL_PER_KG_FAT = 7700;

function fmt(n: number, digits = 0) {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function WeeklyDeficitPanel({ weekLabel, deficitKcal, weightKg }: WeeklyDeficitPanelData) {
  if (deficitKcal == null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-white/80">
          Brakuje sumy celów kalorii na tydzień, więc nie policzę deficytu.
        </p>
        <p className="text-xs text-white/45">
          Ustaw cele kcal w profilu (trening / odpoczynek), a tutaj zobaczysz deficyt dla{" "}
          {weekLabel}.
        </p>
      </div>
    );
  }

  const deficitOnly = Math.max(0, deficitKcal);
  const surplusOnly = Math.max(0, -deficitKcal);

  const kgLoss = deficitOnly > 0 ? deficitOnly / KCAL_PER_KG_FAT : 0;
  const gLoss = kgLoss * 1000;
  const gPerKgBody =
    weightKg != null && Number.isFinite(weightKg) && weightKg > 0
      ? gLoss / weightKg
      : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Tydzień: {weekLabel}. Deficyt liczymy jako (suma celów kcal − suma spożycia kcal) dla
        pon.–niedz.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Deficyt
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight text-emerald-200">
            {fmt(deficitOnly)}{" "}
            <span className="text-base font-normal text-white/55">kcal</span>
          </p>
          {surplusOnly > 0 ? (
            <p className="mt-2 text-xs text-rose-200/90">
              Uwaga: masz też nadwyżkę {fmt(surplusOnly)} kcal (gdy spożycie &gt; cele).
            </p>
          ) : (
            <p className="mt-2 text-xs text-white/45">Poniżej zera kalorycznego w tym tygodniu.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            Szacunkowa utrata
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight text-white">
            {fmt(gLoss)}{" "}
            <span className="text-base font-normal text-white/55">g</span>
          </p>
          <p className="mt-2 text-xs text-white/45">
            Około {fmt(kgLoss, 2)} kg (przy {KCAL_PER_KG_FAT} kcal/kg).
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            g/kg masy ciała
          </p>
          <p className="font-heading mt-2 text-3xl font-semibold tracking-tight text-white">
            {gPerKgBody == null ? "—" : fmt(gPerKgBody, 1)}{" "}
            <span className="text-base font-normal text-white/55">g/kg</span>
          </p>
          <p className="mt-2 text-xs text-white/45">
            {gPerKgBody == null
              ? "Uzupełnij masę ciała w profilu, żeby policzyć g/kg."
              : `Wg masy: ${fmt(weightKg!, 1)} kg.`}
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-snug text-white/40">
        To przybliżenie „z kalorii” — realna zmiana masy zależy m.in. od wody, glikogenu i dokładności
        wpisów.
      </p>
    </div>
  );
}


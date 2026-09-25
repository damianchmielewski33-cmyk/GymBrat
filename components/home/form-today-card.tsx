function Score({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c1e] px-2 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]/80">
        {label}
      </p>
      <p className="mt-2 font-display text-[26px] leading-none tracking-wide text-white">
        {value != null ? value : "—"}
      </p>
      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-white/30">
        / 10
      </p>
    </div>
  );
}

export function FormTodayCard({
  energy,
  sleep,
  digestion,
  training,
}: {
  energy: number | null;
  sleep: number | null;
  digestion: number | null;
  training: number | null;
}) {
  return (
    <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
        Forma dziś
      </p>
      <p className="mt-1 text-xs text-white/40">
        Oceny z ostatniego raportu sylwetki
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Score label="Energia" value={energy} />
        <Score label="Sen" value={sleep} />
        <Score label="Trawienie" value={digestion} />
        <Score label="Trening" value={training} />
      </div>
    </section>
  );
}

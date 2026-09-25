function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <p className="app-label">{label}</p>
      <p className="app-value mt-2 text-2xl font-semibold">
        {value != null ? value : "—"}
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
    <section className="app-card p-5">
      <p className="app-label">⚡ Forma dziś</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Score label="Energia" value={energy} />
        <Score label="Sen" value={sleep} />
        <Score label="Trawienie" value={digestion} />
        <Score label="Trening" value={training} />
      </div>
    </section>
  );
}

export function TeamQuestHistory({
  history,
}: {
  history: Array<{
    id: string;
    title: string;
    emoji: string;
    completedAt: Date;
    totalValue: number;
    participantsCount: number;
    rewardTitle: string;
    unitLabel: string;
  }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-[17px] font-semibold text-white">
        Historia misji
      </h2>
      {history.length === 0 ? (
        <p className="text-[13px] text-white/40">Jeszcze brak ukończonych misji.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-[14px] text-white">
                {h.emoji} {h.title}
              </p>
              <p className="mt-1 text-[12px] text-white/45">
                {h.completedAt.toLocaleDateString("pl-PL")} ·{" "}
                {h.totalValue.toLocaleString("pl-PL")} {h.unitLabel} ·{" "}
                {h.participantsCount} osób · {h.rewardTitle}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

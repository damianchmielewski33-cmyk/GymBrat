import type { HofCategoryBoard } from "@/lib/community/hof-types";

export function HofCategoryPodium({ board }: { board: HofCategoryBoard }) {
  if (board.leaders.length === 0) {
    return (
      <div className="app-card p-4 text-[13px] text-white/40">
        {board.emoji} {board.label} — brak danych w tym okresie.
      </div>
    );
  }
  return (
    <div className="app-card p-4">
      <h3 className="font-heading text-[16px] font-semibold text-white">
        {board.emoji} {board.label}
      </h3>
      <ol className="mt-3 space-y-2">
        {board.leaders.map((l) => (
          <li
            key={`${board.category}-${l.rank}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <span
                className={
                  l.rank === 1
                    ? "font-metric text-[18px] text-[var(--gym-gold)]"
                    : "font-heading text-[16px] text-white/45"
                }
              >
                #{l.rank}
              </span>
              <span className="text-[14px] text-white">{l.displayName}</span>
            </div>
            <span className="text-[12px] text-white/50">{l.scoreLabel}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

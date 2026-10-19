import {
  HOF_CATEGORIES,
  HOF_CATEGORY_META,
  type HofCategory,
} from "@/lib/community/hof-types";

export function HofWinnersHistory({
  historyByCategory,
}: {
  historyByCategory: Partial<
    Record<
      HofCategory,
      Array<{
        seasonKey: string;
        title: string;
        displayName: string;
        scoreLabel: string;
      }>
    >
  >;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-[18px] font-semibold text-white">
        Historia zwycięzców
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {HOF_CATEGORIES.map((cat) => {
          const rows = historyByCategory[cat] ?? [];
          const meta = HOF_CATEGORY_META[cat];
          return (
            <div key={cat} className="app-card p-4">
              <p className="text-[12px] text-white/45">
                {meta.emoji} {meta.label}
              </p>
              {rows.length === 0 ? (
                <p className="mt-2 text-[13px] text-white/35">Brak archiwum.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {rows.map((r) => (
                    <li
                      key={`${cat}-${r.seasonKey}`}
                      className="flex justify-between gap-2 text-[13px]"
                    >
                      <span className="text-white/80">
                        {r.displayName}{" "}
                        <span className="text-white/35">· {r.title}</span>
                      </span>
                      <span className="shrink-0 text-white/45">
                        {r.scoreLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

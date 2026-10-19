import { HOF_CATEGORIES, HOF_CATEGORY_META } from "@/lib/community/hof-types";

export function HofBadgeGallery({
  badges,
}: {
  badges: Array<{ badgeKey: string; title: string; emoji: string }>;
}) {
  const unlocked = new Set(badges.map((b) => b.badgeKey));
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-[18px] font-semibold text-white">
        Galeria odznak HoF
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {HOF_CATEGORIES.map((cat) => {
          const meta = HOF_CATEGORY_META[cat];
          const mine = badges.filter((b) => b.badgeKey.includes(cat));
          const on = mine.length > 0 || [...unlocked].some((k) => k.includes(cat));
          return (
            <div
              key={cat}
              className={
                on
                  ? "rounded-xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 p-3 text-center"
                  : "rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center opacity-45"
              }
            >
              <p className="text-[22px]">{meta.emoji}</p>
              <p className="mt-1 text-[11px] text-white/70">{meta.label}</p>
              {mine.length > 0 ? (
                <p className="mt-1 text-[10px] text-[var(--gym-gold)]">
                  ×{mine.length}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

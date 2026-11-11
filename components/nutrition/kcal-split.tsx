import type { MacroBalance } from "@/lib/nutrition-day-balance";

const PARTS = [
  { key: "protein", label: "Białko", short: "B", factor: 4, color: "var(--gym-gold)" },
  { key: "carbs", label: "Węgle", short: "W", factor: 4, color: "rgba(255,255,255,0.8)" },
  { key: "fat", label: "Tłuszcz", short: "T", factor: 9, color: "color-mix(in srgb, var(--gym-gold) 40%, #444)" },
] as const;

function shares(
  macros: MacroBalance[],
  field: "consumed" | "goal",
): { key: string; pct: number }[] | null {
  const kcal = PARTS.map((p) => {
    const m = macros.find((x) => x.key === p.key);
    const g = field === "goal" ? m?.goal : m?.consumed;
    return { key: p.key, kcal: (g ?? 0) * p.factor };
  });
  const total = kcal.reduce((n, k) => n + k.kcal, 0);
  if (!(total > 0)) return null;
  return kcal.map((k) => ({ key: k.key, pct: Math.round((k.kcal / total) * 100) }));
}

function Bar({
  label,
  data,
}: {
  label: string;
  data: { key: string; pct: number }[] | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px] text-[var(--gym-text-secondary)]">
        <span className="font-semibold uppercase tracking-[0.14em]">{label}</span>
        <span className="tabular-nums">
          {data
            ? data
                .map((d) => `${PARTS.find((p) => p.key === d.key)!.short} ${d.pct}%`)
                .join(" · ")
            : "brak wpisów"}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--gym-track)]">
        {data?.map((d) => (
          <div
            key={d.key}
            className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{
              width: `${d.pct}%`,
              background: PARTS.find((p) => p.key === d.key)!.color,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Skąd pochodzą kalorie: udział B/W/T w kcal — plan vs faktycznie. */
export function KcalSplit({ macros }: { macros: MacroBalance[] }) {
  const plan = shares(macros, "goal");
  const actual = shares(macros, "consumed");
  if (!plan && !actual) return null;
  return (
    <div className="space-y-2.5 border-t border-white/10 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
        Skąd kalorie (B = białko, W = węgle, T = tłuszcz)
      </p>
      <Bar label="Plan" data={plan} />
      <Bar label="Dziś" data={actual} />
    </div>
  );
}

export function TeamQuestProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative">
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold)] via-amber-300 to-[var(--neon)] transition-all duration-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-3 justify-between px-[24%]">
        {[25, 50, 75].map((m) => (
          <span
            key={m}
            className="h-full w-px bg-white/25"
            style={{ marginLeft: m === 25 ? 0 : undefined }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

/** Placeholder podczas ładowania async `DailyBriefingCard` (np. wywołanie modelu AI). */
export function DailyBriefingSkeleton() {
  return (
    <section className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6" aria-busy="true" aria-label="Ładowanie briefingu dnia">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(720px_280px_at_10%_0%,rgba(255,45,85,0.14),transparent_58%)]" />
      <div className="relative flex gap-3">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-white/15" />
          <div className="h-6 w-48 max-w-[60%] animate-pulse rounded bg-white/12" />
          <div className="h-3 w-full animate-pulse rounded bg-white/[0.08]" />
          <div className="h-3 w-[92%] animate-pulse rounded bg-white/[0.08]" />
          <div className="h-3 w-[70%] animate-pulse rounded bg-white/[0.08]" />
        </div>
      </div>
    </section>
  );
}

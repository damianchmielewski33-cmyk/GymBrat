/** Z61: szkielet Analizy z opisem dla czytnika ekranu i widocznym podpisem. */
export function ProgressSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <p className="px-0.5 text-[length:var(--text-label)] text-[var(--gym-text-secondary)]">
        Ładuję analizę postępów…
      </p>
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="app-card h-[84px] rounded-2xl bg-white/[0.04]" />
          <div className="app-card h-[84px] rounded-2xl bg-white/[0.04]" />
        </div>
        <div className="app-card h-[220px] rounded-2xl bg-white/[0.04]" />
        <div className="app-card h-[160px] rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

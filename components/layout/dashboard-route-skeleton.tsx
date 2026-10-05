/** Placeholder podczas ładowania zakładek dolnej belki (RSC / Suspense). */
export function DashboardRouteSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Ładowanie ekranu">
      <div className="app-card h-[168px] rounded-2xl bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="app-card h-[118px] rounded-2xl bg-white/[0.04]" />
        <div className="app-card h-[118px] rounded-2xl bg-white/[0.04]" />
      </div>
      <div className="app-card h-[220px] rounded-2xl bg-white/[0.04]" />
    </div>
  );
}

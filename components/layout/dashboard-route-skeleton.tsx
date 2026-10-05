/** Placeholder podczas ładowania zakładek dolnej belki (RSC / Suspense). */
export function DashboardRouteSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Ładowanie ekranu">
      <div className="app-card-raised h-[72px] rounded-2xl bg-white/[0.04]" />
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-white/10" />
        <div className="h-9 w-56 max-w-[70%] rounded bg-white/[0.08]" />
        <div className="h-4 w-44 rounded bg-white/[0.06]" />
      </div>
      <div className="app-card h-[168px] rounded-2xl bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="app-card h-[118px] rounded-2xl bg-white/[0.04]" />
        <div className="app-card h-[118px] rounded-2xl bg-white/[0.04]" />
      </div>
      <div className="app-card h-[220px] rounded-2xl bg-white/[0.04]" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-white/65">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[var(--neon)]"
        aria-hidden
      />
      <p className="text-sm font-medium tracking-wide text-white/70">Ładowanie…</p>
    </div>
  );
}

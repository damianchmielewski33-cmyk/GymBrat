/** Szkielet nagłówka Pulpitu (LCP placeholder). */
export function HomeHeaderSkeleton() {
  return (
    <header
      className="flex animate-pulse items-start justify-between gap-3 pt-1"
      aria-busy="true"
      aria-label="Ładowanie nagłówka"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-40 max-w-[70%] rounded bg-white/10" />
        <div className="h-9 w-56 max-w-[85%] rounded bg-white/[0.08]" />
        <div className="h-4 w-48 max-w-[90%] rounded bg-white/[0.06]" />
      </div>
      <div className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06]" />
    </header>
  );
}

function Sk({ className }: { className: string }) {
  return (
    <div
      className={`rounded-lg bg-gradient-to-r from-white/[0.05] via-white/[0.1] to-white/[0.05] bg-[length:200%_100%] motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Szkielet ekranu z dolnej belki (pulpit: hero, tydzień, makro, sylwetka). */
export function DashboardRouteSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <p role="status" className="sr-only">
        Ładowanie ekranu…
      </p>
      <section className="app-card p-5" aria-hidden>
        <Sk className="h-3.5 w-28" />
        <Sk className="mt-3 h-12 w-52" />
        <Sk className="mt-3 h-3.5 w-60 max-w-full" />
        <Sk className="mt-4 h-14 w-full !rounded-2xl" />
        <Sk className="mt-2.5 h-12 w-full !rounded-2xl" />
      </section>
      <section className="app-card p-5" aria-hidden>
        <Sk className="h-3.5 w-24" />
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Sk className="h-14" />
          <Sk className="h-14" />
          <Sk className="h-14" />
        </div>
        <Sk className="mt-4 h-2 w-full" />
      </section>
      <section className="app-card p-5" aria-hidden>
        <Sk className="h-3.5 w-16" />
        <Sk className="mt-3 h-11 w-full !rounded-xl" />
        <Sk className="mt-4 h-14 w-44" />
        <Sk className="mt-5 h-2 w-full" />
        <Sk className="mt-8 h-2 w-full" />
        <Sk className="mt-8 h-2 w-full" />
      </section>
    </div>
  );
}

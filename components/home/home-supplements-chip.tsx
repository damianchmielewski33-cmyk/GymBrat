import Link from "next/link";
import {
  DEFAULT_DIET_SUPPLEMENTS,
  type DietSupplement,
} from "@/lib/diet-supplements";

/** Suplementy na dziś: siatka kafelków (nazwa + dawka); dotknięcie prowadzi do ekranu suplementów. */
export function HomeSupplementsChip({
  names,
  items,
}: {
  /** @deprecated — preferuj `items` */
  names?: string[] | null;
  /** `null`/`undefined` = domyślna lista; `[]` = brak suplementów. */
  items?: DietSupplement[] | null;
}) {
  const list: DietSupplement[] =
    items != null
      ? items
      : names != null
        ? names.map((n) => ({ name: n.trim() })).filter((s) => s.name)
        : DEFAULT_DIET_SUPPLEMENTS.map((name) => ({ name }));

  return (
    <section className="app-card p-4" aria-labelledby="home-supp-h">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-supp-h"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
        >
          Suplementy na dziś
        </h2>
        <Link
          href="/supplements"
          className="inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--gym-gold)]"
        >
          {list.length === 0 ? "Dodaj →" : "Zarządzaj →"}
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-white/60">Dodaj suplementy i dawki.</p>
      ) : (
        <>
          <p className="-mt-1.5 mb-2 text-[12px] text-white/60">
            <span className="font-display text-[26px] leading-none text-white">
              {list.length}
            </span>{" "}
            {list.length === 1 ? "suplement" : "suplementy"} w planie dnia
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {list.map((s) => (
              <li key={s.name} className="min-w-0">
                <Link
                  href="/supplements"
                  className="gym-tap flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-white/[0.1] bg-black/30 px-3 py-1.5 transition-colors hover:border-[var(--gym-gold)]/40"
                >
                  <span
                    aria-hidden
                    className="h-6 w-6 shrink-0 rounded-full border-[1.5px] border-[var(--gym-gold)]/50"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-white">
                      {s.name}
                    </span>
                    {s.amount ? (
                      <span className="block truncate text-[10px] text-white/55">
                        {s.amount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

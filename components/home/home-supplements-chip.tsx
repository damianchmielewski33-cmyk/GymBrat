import Link from "next/link";
import {
  DEFAULT_DIET_SUPPLEMENTS,
  formatSupplementLine,
  type DietSupplement,
} from "@/lib/diet-supplements";

/** Suplementy na dziś jako chipy; dotknięcie prowadzi do ekranu suplementów. */
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
    <section className="app-card p-5" aria-labelledby="home-supp-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-supp-h" className="text-[13px] font-semibold text-white/60">
          Suplementy na dziś
        </h2>
        <Link
          href="/supplements"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--gym-gold)]"
        >
          {list.length === 0 ? "Dodaj" : "Zarządzaj"}
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-white/60">Dodaj suplementy i dawki.</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-2">
          {list.map((s) => (
            <li key={s.name}>
              <Link
                href="/supplements"
                className="gym-tap inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-black/40 px-3.5 text-sm font-medium text-white"
              >
                {formatSupplementLine(s)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

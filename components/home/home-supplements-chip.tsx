import Link from "next/link";
import { ChevronRight, Pill } from "lucide-react";
import {
  DEFAULT_DIET_SUPPLEMENTS,
  formatSupplementLine,
  type DietSupplement,
} from "@/lib/diet-supplements";

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

  const visible = list.slice(0, 3).map(formatSupplementLine);
  const extra = Math.max(0, list.length - 3);
  const summary =
    visible.join(", ") + (extra > 0 ? `, +${extra}` : "");

  return (
    <Link
      href="/supplements"
      className="app-card flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/[0.04]"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]">
        <Pill className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">
          Suplementy na dziś
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-white/45">
          {summary || "Dodaj suplementy i dawki"}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
    </Link>
  );
}

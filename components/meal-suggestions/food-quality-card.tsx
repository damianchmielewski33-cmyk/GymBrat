"use client";

import type { FoodProduct } from "@/lib/food-products-types";
import {
  computeFoodQuality,
  computeSaltInfo,
  NOVA_LABELS,
  SALT_DAILY_LIMIT_G,
  type NutriGrade,
  type SaltLevel,
} from "@/lib/food-quality";
import { cn } from "@/lib/utils";

const GRADES: NutriGrade[] = ["A", "B", "C", "D", "E"];

const GRADE_STYLE: Record<NutriGrade, { text: string; bg: string; stroke: string; label: string }> = {
  A: { text: "text-emerald-300", bg: "bg-emerald-500", stroke: "#34d399", label: "Bardzo dobra jakość" },
  B: { text: "text-lime-300", bg: "bg-lime-500", stroke: "#a3e635", label: "Dobra jakość" },
  C: { text: "text-amber-300", bg: "bg-amber-400", stroke: "#fbbf24", label: "Przeciętna jakość" },
  D: { text: "text-orange-300", bg: "bg-orange-500", stroke: "#fb923c", label: "Słaba jakość" },
  E: { text: "text-rose-300", bg: "bg-rose-500", stroke: "#fb7185", label: "Zła jakość" },
};

const SALT_STYLE: Record<SaltLevel, { bar: string; text: string; label: string }> = {
  low: { bar: "bg-emerald-400", text: "text-emerald-300", label: "Mało soli" },
  medium: { bar: "bg-amber-400", text: "text-amber-300", label: "Średnio soli" },
  high: { bar: "bg-rose-400", text: "text-rose-300", label: "Dużo soli" },
};

function fmt(n: number, digits = 1): string {
  const f = 10 ** digits;
  return String(Math.round(n * f) / f).replace(".", ",");
}

function ScoreMeter({ score, grade }: { score: number; grade: NutriGrade }) {
  const r = 52;
  const arc = Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * arc;
  return (
    <div className="relative mx-auto h-[84px] w-[132px]" role="img" aria-label={`Ocena jakości ${score} na 100`}>
      <svg viewBox="0 0 132 84" className="h-full w-full" aria-hidden>
        <path
          d="M 14 70 A 52 52 0 0 1 118 70"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 14 70 A 52 52 0 0 1 118 70"
          fill="none"
          stroke={GRADE_STYLE[grade].stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`}
          className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-display text-[34px] font-semibold leading-none tabular-nums text-white">
          {score}
        </p>
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/50">/ 100 pkt</p>
      </div>
    </div>
  );
}

export function FoodQualityCard({
  product,
  effectiveGrams,
}: {
  product: FoodProduct;
  effectiveGrams: number | null;
}) {
  const quality = computeFoodQuality(product);
  const salt = computeSaltInfo(product, effectiveGrams);

  if (!quality && !salt) {
    return (
      <div className="rounded-[20px] border border-white/[0.08] bg-[#161616] px-4 py-4 text-[13px] text-white/60">
        Brak danych o cukrach, tłuszczach nasyconych i soli — nie możemy ocenić jakości tego produktu.
      </div>
    );
  }

  const g = quality ? GRADE_STYLE[quality.grade] : null;

  return (
    <div className="space-y-4 rounded-[20px] border border-white/[0.08] bg-[#161616] px-4 py-4">
      {quality && g ? (
        <div>
          <ScoreMeter score={quality.score} grade={quality.grade} />
          <p className={cn("mt-2 text-center text-[14px] font-semibold", g.text)}>{g.label}</p>

          <div className="mt-3 flex items-center justify-center gap-1.5" aria-label={`Nutri-Score ${quality.grade}`}>
            {GRADES.map((letter) => {
              const active = letter === quality.grade;
              return (
                <span
                  key={letter}
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg font-display font-semibold transition-all",
                    active
                      ? cn("h-10 w-10 text-[20px] text-black", GRADE_STYLE[letter].bg)
                      : "h-8 w-8 bg-white/[0.06] text-[14px] text-white/60",
                  )}
                >
                  {letter}
                </span>
              );
            })}
          </div>

          {quality.reasons.length > 0 ? (
            <p className="mt-3 text-center text-[12px] leading-snug text-white/60">
              {quality.reasons.join(" · ")}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/50">
            {quality.novaGroup ? (
              <span className="rounded-full border border-white/12 px-2.5 py-1">
                NOVA {quality.novaGroup} · {NOVA_LABELS[quality.novaGroup]}
              </span>
            ) : null}
            <span className="rounded-full border border-white/12 px-2.5 py-1">
              {quality.source === "openfoodfacts" ? "Ocena: Open Food Facts" : "Nutri-Score (wyliczony)"}
              {quality.approximate ? " · przybliżony" : ""}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-center text-[13px] text-white/60">
          Brak danych do oceny punktowej — pokazujemy tylko zawartość soli.
        </p>
      )}

      {salt ? (
        <div className={cn(quality ? "border-t border-white/[0.06] pt-4" : "")}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">Sól</p>
            <p className="font-display text-[22px] font-semibold leading-none tabular-nums text-white">
              {fmt(salt.portionG, 2)} <span className="text-[14px] font-medium text-white/60">g</span>
            </p>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]"
            role="meter"
            aria-label="Udział soli w dziennym limicie"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, salt.dailyPct)}
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", SALT_STYLE[salt.level].bar)}
              style={{ width: `${Math.min(100, salt.dailyPct)}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-white/60">
            <span className={cn("font-semibold", SALT_STYLE[salt.level].text)}>{SALT_STYLE[salt.level].label}</span>
            {" · "}
            {salt.dailyPct}% dziennego limitu ({SALT_DAILY_LIMIT_G} g WHO) · {fmt(salt.per100G, 2)} g / 100 g
          </p>
        </div>
      ) : null}
    </div>
  );
}

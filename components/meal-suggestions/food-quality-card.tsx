"use client";

import { AlertCircle } from "lucide-react";
import type { FoodProduct } from "@/lib/food-products-types";
import {
  computeFoodQuality,
  computeSaltInfo,
  NOVA_LABELS,
  SALT_DAILY_LIMIT_G,
  type FoodQuality,
  type NutriGrade,
  type SaltLevel,
} from "@/lib/food-quality";
import { cn } from "@/lib/utils";

const GRADES: NutriGrade[] = ["A", "B", "C", "D", "E"];

export const GRADE_STYLE: Record<NutriGrade, { text: string; bg: string; stroke: string; label: string }> = {
  A: { text: "text-emerald-300", bg: "bg-emerald-400", stroke: "#3ecf72", label: "Bardzo dobra jakość" },
  B: { text: "text-lime-300", bg: "bg-lime-400", stroke: "#a3e635", label: "Dobra jakość" },
  C: { text: "text-amber-300", bg: "bg-amber-400", stroke: "#fbbf24", label: "Przeciętna jakość" },
  D: { text: "text-orange-300", bg: "bg-orange-400", stroke: "#fb923c", label: "Słaba jakość" },
  E: { text: "text-rose-300", bg: "bg-rose-500", stroke: "#f43f5e", label: "Zła jakość" },
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

/** Kafel werdyktu przy nazwie produktu — przewija do sekcji jakości. */
export function QualityVerdictBadge({ quality }: { quality: FoodQuality }) {
  const g = GRADE_STYLE[quality.grade];
  return (
    <a
      href="#jakosc"
      aria-label={`Ocena jakości ${quality.score} na 100, Nutri-Score ${quality.grade}. Przejdź do szczegółów`}
      className="flex min-h-[44px] min-w-[64px] shrink-0 flex-col items-center gap-1.5 text-white"
    >
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl font-display text-[38px] leading-none text-black",
          g.bg,
        )}
      >
        {quality.grade}
      </span>
      <span className="text-[12px] text-white/80">
        <b className="font-heading tabular-nums">{quality.score}</b>/100
      </span>
    </a>
  );
}

function ScoreMeter({ score, grade }: { score: number; grade: NutriGrade }) {
  const r = 64;
  const arc = Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * arc;
  return (
    <div className="relative h-[92px] w-[150px] shrink-0" role="img" aria-label={`Ocena ${score} na 100`}>
      <svg viewBox="0 0 160 92" className="h-full w-full" aria-hidden>
        <path d="M16 80 A64 64 0 0 1 144 80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M16 80 A64 64 0 0 1 144 80"
          fill="none"
          stroke={GRADE_STYLE[grade].stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`}
          className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-display text-[42px] leading-[0.9] tabular-nums text-white">{score}</p>
        <p className="text-[10px] tracking-[0.12em] text-white/60">/ 100 PKT</p>
      </div>
    </div>
  );
}

function Chip({ tone, children }: { tone: "pro" | "con"; children: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1.5 text-[12px]",
        tone === "pro"
          ? "border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-200"
          : "border-rose-400/40 bg-rose-400/[0.08] text-rose-200",
      )}
    >
      {tone === "pro" ? "+ " : "− "}
      {children}
    </span>
  );
}

function Per100({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div>
      <p className="font-heading text-[16px] font-semibold tabular-nums text-white">
        {value == null ? "b.d." : `${fmt(value)} g`}
      </p>
      <p className="mt-0.5 text-[11px] text-white/60">{label}</p>
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
  const d = product.details;

  if (!quality && !salt) {
    return (
      <div className="rounded-[22px] border border-white/[0.08] bg-[#161616] px-5 py-7 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.07]">
          <AlertCircle className="h-6 w-6 text-white/75" aria-hidden />
        </span>
        <p className="mt-3.5 text-[15px] font-semibold text-white">Brak danych do oceny</p>
        <p className="mt-1.5 text-[13px] leading-snug text-white/60">
          Ten produkt nie ma w bazie cukrów, tłuszczów nasyconych ani soli, więc nie wyliczymy punktów.
          Makroskładniki są nadal poprawne.
        </p>
      </div>
    );
  }

  const g = quality ? GRADE_STYLE[quality.grade] : null;

  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[#161616] px-4 py-[18px]">
      {quality && g ? (
        <>
          <div className="flex items-center gap-4">
            <ScoreMeter score={quality.score} grade={quality.grade} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-[15px] font-semibold", g.text)}>{g.label}</p>
              <div className="mt-2.5 flex items-center gap-1" role="img" aria-label={`Nutri-Score ${quality.grade}`}>
                {GRADES.map((letter) => {
                  const active = letter === quality.grade;
                  return (
                    <span
                      key={letter}
                      className={cn(
                        "inline-flex items-center justify-center rounded-[9px] font-display",
                        active
                          ? cn("h-[38px] w-[38px] text-[26px] text-black", GRADE_STYLE[letter].bg)
                          : "h-7 w-7 bg-white/[0.07] text-[18px] text-white/60",
                      )}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[11px] leading-snug text-white/60">
                Nutri-Score
                {quality.novaGroup ? ` · NOVA ${quality.novaGroup} (${NOVA_LABELS[quality.novaGroup].toLowerCase()})` : ""}
              </p>
            </div>
          </div>

          {quality.cons.length + quality.pros.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {quality.cons.map((t) => (
                <Chip key={t} tone="con">{t}</Chip>
              ))}
              {quality.pros.map((t) => (
                <Chip key={t} tone="pro">{t}</Chip>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-white/60">
          Brak danych do oceny punktowej — pokazujemy tylko zawartość soli.
        </p>
      )}

      {salt ? (
        <div className={cn(quality ? "mt-[18px] border-t border-white/[0.08] pt-4" : "")}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-white/70">SÓL W PORCJI</p>
            <p className="font-display text-[30px] leading-none tabular-nums text-white">
              {fmt(salt.portionG, 2)} <span className="text-[16px] text-white/70">g</span>
            </p>
          </div>
          <div
            className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/10"
            role="meter"
            aria-label="Udział soli w dziennym limicie"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, salt.dailyPct)}
          >
            <div
              className={cn(
                "h-full min-w-2 rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                SALT_STYLE[salt.level].bar,
              )}
              style={{ width: `${Math.min(100, salt.dailyPct)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-white/60">
            <span>0 g</span>
            <span>limit WHO {SALT_DAILY_LIMIT_G} g</span>
          </div>
          <p className="mt-2 text-[13px] text-white/80">
            <b className={SALT_STYLE[salt.level].text}>{SALT_STYLE[salt.level].label}</b> · {salt.dailyPct}% dziennego
            limitu · {fmt(salt.per100G, 2)} g / 100 g
          </p>
        </div>
      ) : null}

      {quality ? (
        <>
          <div className="mt-[18px] grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3.5 text-center">
            <Per100 label="cukry" value={d?.sugarsG} />
            <Per100 label="nasycone" value={d?.saturatedFatG} />
            <Per100 label="błonnik" value={d?.fiberG} />
          </div>
          <p className="mt-3 text-[11px] text-white/60">
            {quality.source === "openfoodfacts" ? "Nutri-Score z Open Food Facts" : "Nutri-Score wyliczony z etykiety"}
            {quality.approximate ? " (przybliżony)" : ""} · wartości na 100 g
          </p>
        </>
      ) : null}
    </div>
  );
}

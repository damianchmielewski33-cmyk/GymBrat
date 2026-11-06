"use client";

import { useId, useMemo, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BRAND_GOLD, BRAND_GOLD_BRIGHT } from "@/lib/brand-colors";
import { Meter } from "@/components/progress/progress-ui";
import { fmtNum } from "@/lib/progress-format";
import {
  CHART_BOX,
  CHART_RANGES,
  buildChartModel,
  nearestPointIndex,
  type ChartRange,
} from "@/lib/progress-view";
import { cn } from "@/lib/utils";

/** Wspólne klocki wykresów Analizy: ta sama konstrukcja w Sile, Ciele i szczególe ćwiczenia. */

const GOLD = BRAND_GOLD;
const GOLD_BRIGHT = BRAND_GOLD_BRIGHT;

export type Tone = "up" | "down" | "flat";

/** Kolor + zawsze tekst/strzałka, nigdy sam kolor. */
export function toneClass(tone: Tone): string {
  if (tone === "up") return "text-[var(--gym-success)]";
  if (tone === "down") return "text-[var(--gym-skipped)]";
  return "text-[var(--gym-text-secondary)]";
}

export function toneArrow(tone: Tone): string {
  return tone === "up" ? "▲" : tone === "down" ? "▼" : "=";
}

/** Zdanie definicji obok liczby. */
export function Definition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-[13px] leading-snug text-[var(--gym-text-secondary)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function RangeChips({
  value,
  onChange,
  options = CHART_RANGES,
  ariaLabel = "Zakres czasu",
}: {
  value: ChartRange;
  onChange: (next: ChartRange) => void;
  options?: ReadonlyArray<{ id: ChartRange; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-11 flex-1 rounded-xl border px-2 text-[13px] font-semibold transition active:scale-[0.97]",
            o.id === value
              ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/15 text-[var(--gym-gold-bright)]"
              : "border-white/10 bg-black/30 text-[var(--gym-text-secondary)] hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sparkline({
  values,
  color = GOLD_BRIGHT,
  className,
}: {
  values: readonly number[];
  color?: string;
  className?: string;
}) {
  const pts = useMemo(() => {
    const v = values.length >= 2 ? values : values.length === 1 ? [values[0]!, values[0]!] : [];
    if (!v.length) return "";
    const mn = Math.min(...v);
    const mx = Math.max(...v);
    const s = mx - mn || 1;
    return v
      .map((x, i) => `${4 + (i * 72) / (v.length - 1)},${(26 - ((x - mn) / s) * 22).toFixed(1)}`)
      .join(" ");
  }, [values]);
  if (!pts) return null;
  return (
    <svg viewBox="0 0 80 30" className={cn("h-7 w-[72px] shrink-0", className)} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Interaktywny wykres liniowy: gładka linia z gradientem, osie z wartościami, ostatni punkt.
 * Wybór punktu myszą, dotykiem lub strzałkami (na wykresie i przyciskami pod nim).
 */
export function InteractiveLineChart({
  values,
  labels,
  axisLabels,
  selected,
  onSelect,
  unit,
  decimals = 0,
  goal,
  ariaLabel,
  subject,
  prevLabel = "Poprzedni punkt",
  nextLabel = "Następny punkt",
}: {
  values: readonly number[];
  /** Pełna etykieta punktu (dla dymku), np. „28.10”. */
  labels: readonly string[];
  /** Krótkie etykiety osi X dla każdego punktu (puste = pomiń). */
  axisLabels?: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
  unit: string;
  decimals?: number;
  goal?: { value: number; label: string };
  /** Opis dla czytnika ekranu. */
  ariaLabel: string;
  subject: string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const model = useMemo(
    () => buildChartModel(values, goal ? [goal.value] : []),
    [values, goal],
  );
  const n = values.length;
  const idx = Math.min(Math.max(selected, 0), Math.max(n - 1, 0));
  const sel = model.points[idx];
  const { left, right, bottom, top, width, height } = CHART_BOX;

  function pick(e: PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    onSelect(nearestPointIndex(((e.clientX - r.left) / r.width) * width, n));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(Math.max(0, idx - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(Math.min(n - 1, idx + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelect(n - 1);
    }
  }

  if (n === 0 || !sel) return null;

  const tipW = 84;
  const tipX = Math.max(left - 12, Math.min(right - tipW + 8, sel.x - tipW / 2));
  const everyTick = Math.max(1, Math.ceil(n / 5));
  const filteredTicks: number[] = [];
  for (let i = 0; i < n; i += everyTick) filteredTicks.push(i);
  const lastTick = filteredTicks[filteredTicks.length - 1]!;
  if (lastTick !== n - 1) {
    // Ostatni punkt zawsze ma etykietę; jeśli jest tuż obok poprzedniej, zastępuje ją.
    if (n - 1 - lastTick >= Math.ceil(everyTick / 2)) filteredTicks.push(n - 1);
    else filteredTicks[filteredTicks.length - 1] = n - 1;
  }
  const fmtV = (v: number) => fmtNum(v, decimals);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        className="mt-2 block touch-pan-y select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold-bright)]"
        style={{ aspectRatio: `${width} / ${height}` }}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-roledescription="wykres, wybierz punkt strzałkami"
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={idx}
        aria-valuetext={`${subject}, ${labels[idx]}: ${fmtV(values[idx]!)} ${unit}`}
        onKeyDown={onKey}
      >
        <defs>
          <linearGradient id={`a${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GOLD} stopOpacity=".38" />
            <stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`l${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={GOLD} />
            <stop offset="1" stopColor={GOLD_BRIGHT} />
          </linearGradient>
        </defs>
        {model.grid.map((g, i) => (
          <g key={i}>
            <line x1={left - 2} y1={g.y} x2={right + 2} y2={g.y} stroke="#26231c" />
            <text x={0} y={g.y + 4} fill="#9a9182" fontSize={12}>
              {fmtV(g.value)}
            </text>
          </g>
        ))}
        {goal ? (
          <g>
            <line
              x1={left - 2}
              y1={model.yOf(goal.value)}
              x2={right + 2}
              y2={model.yOf(goal.value)}
              stroke="#3ecf72"
              strokeDasharray="5 5"
            />
            <text
              x={right}
              y={model.yOf(goal.value) - 5}
              textAnchor="end"
              fill="#3ecf72"
              fontSize={11}
            >
              {goal.label}
            </text>
          </g>
        ) : null}
        {model.area ? <path d={model.area} fill={`url(#a${gid})`} className="pv-area" /> : null}
        {n > 1 ? (
          <path
            d={model.line}
            pathLength={1}
            fill="none"
            stroke={`url(#l${gid})`}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pv-draw"
          />
        ) : null}
        {n <= 40
          ? model.points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#0c0c0e" stroke={GOLD} strokeWidth={2} />
            ))
          : null}
        <line
          x1={sel.x}
          y1={top - 18}
          x2={sel.x}
          y2={bottom}
          stroke={GOLD_BRIGHT}
          strokeOpacity={0.5}
          strokeDasharray="3 3"
        />
        <circle cx={sel.x} cy={sel.y} r={6} fill="#f6e3a1" stroke="#b58f3e" strokeWidth={2} />
        <g aria-hidden>
          <rect x={tipX} y={0} width={tipW} height={34} rx={9} fill="#0c0c0e" stroke={GOLD} />
          <text x={tipX + tipW / 2} y={15} textAnchor="middle" fill="#f6e3a1" fontSize={15} fontWeight={700}>
            {fmtV(values[idx]!)} {unit}
          </text>
          <text x={tipX + tipW / 2} y={28} textAnchor="middle" fill="#9a9182" fontSize={11}>
            {labels[idx]}
          </text>
        </g>
        {filteredTicks.map((i) => (
          <text
            key={i}
            x={model.points[i]!.x}
            y={height - 4}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fill="#9a9182"
            fontSize={11}
          >
            {(axisLabels ?? labels)[i]}
          </text>
        ))}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onPointerDown={pick}
          onPointerMove={(e) => {
            if (e.pointerType === "mouse" || e.buttons) pick(e);
          }}
        />
      </svg>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={prevLabel}
          disabled={idx <= 0}
          onClick={() => onSelect(idx - 1)}
          className="flex h-11 w-14 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white disabled:opacity-35"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-center text-[12px] text-[var(--gym-text-secondary)]">
          Dotknij wykresu albo użyj strzałek
        </span>
        <button
          type="button"
          aria-label={nextLabel}
          disabled={idx >= n - 1}
          onClick={() => onSelect(idx + 1)}
          className="flex h-11 w-14 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white disabled:opacity-35"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Słupki tygodni (klikalne), z podświetleniem wybranego. */
export function WeekBars({
  items,
  selected,
  onSelect,
  ariaLabel,
}: {
  items: ReadonlyArray<{ label: string; display: string; value: number; aria: string }>;
  selected: number;
  onSelect: (i: number) => void;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      <div role="group" aria-label={ariaLabel} className="flex h-[150px] items-end gap-2">
        {items.map((it, i) => {
          const on = i === selected;
          return (
            <button
              key={i}
              type="button"
              aria-label={it.aria}
              aria-pressed={on}
              onClick={() => onSelect(i)}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-inherit"
            >
              <span className={cn("text-[12px] tabular-nums", on ? "text-[#f6e3a1]" : "text-[var(--gym-text-secondary)]")}>
                {it.display}
              </span>
              <i
                className={cn("block w-full rounded-t-md rounded-b-sm transition-[height] duration-700", on ? "gym-meter-gold" : "bg-[#3a3524]")}
                style={{
                  height: `${Math.max(it.value > 0 ? 4 : 0, Math.round((it.value / max) * 100))}%`,
                  outline: on ? `2px solid ${BRAND_GOLD_BRIGHT}` : "none",
                  outlineOffset: 2,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {items.map((it, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-[11px] text-[var(--gym-text-secondary)]">
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Wiersz miernika z podpisem i liczbą po prawej. */
export function MeterRow({
  title,
  right,
  pct,
  note,
}: {
  title: ReactNode;
  right?: ReactNode;
  pct: number;
  note?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="font-semibold text-white">{title}</span>
        {right ? <span className="text-right text-[13px] text-[var(--gym-text-secondary)]">{right}</span> : null}
      </div>
      <Meter pct={pct} size="lg" className="my-1.5" barClassName="gym-meter-gold" aria-label={typeof title === "string" ? title : undefined} />
      {note ? <div className="text-[13px] leading-snug text-[var(--gym-text-secondary)]">{note}</div> : null}
    </div>
  );
}

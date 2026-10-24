import { Dumbbell } from "lucide-react";
import type {
  PlanDayMuscleGroupId,
  PlanDayMuscleSummary,
} from "@/lib/plan-day-muscles";
import { cn } from "@/lib/utils";

/**
 * Sylwetka z zaznaczonymi partiami dnia planu (własny rysunek, LR-7).
 * Geometria i kolory: docs/ux/003-przebudowa-ekranu-trening.md, sekcja 6.
 * Zawsze `aria-hidden` — tekstowy odpowiednik daje rodzic (LR-5).
 */

type GlyphRegion =
  | "barki"
  | "klatka"
  | "brzuch"
  | "plecy"
  | "ramiona"
  | "posladki"
  | "uda"
  | "lydki";

type GlyphView = PlanDayMuscleSummary["view"];

type RectShape = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
};
type CircleShape = { kind: "circle"; cx: number; cy: number; r: number };
type LineShape = { kind: "line"; x1: number; y1: number; x2: number; y2: number };

type GlyphPart = {
  /** `null` = głowa, zawsze baza. */
  region: GlyphRegion | null;
  views: readonly GlyphView[];
  shape: RectShape | CircleShape | LineShape;
};

const BOTH: readonly GlyphView[] = ["front", "back"];
const FRONT: readonly GlyphView[] = ["front"];
const BACK: readonly GlyphView[] = ["back"];

function rect(x: number, y: number, width: number, height: number, rx: number): RectShape {
  return { kind: "rect", x, y, width, height, rx };
}

/** Kolejność = kolejność rysowania (kręgosłup nad plecami). */
const GLYPH_PARTS: readonly GlyphPart[] = [
  { region: null, views: BOTH, shape: { kind: "circle", cx: 12, cy: 3, r: 2.2 } },
  { region: "barki", views: BOTH, shape: rect(6, 6, 2.6, 2.6, 1.3) },
  { region: "barki", views: BOTH, shape: rect(15.4, 6, 2.6, 2.6, 1.3) },
  { region: "klatka", views: FRONT, shape: rect(9.3, 6, 5.4, 3.8, 1.2) },
  { region: "brzuch", views: FRONT, shape: rect(9.6, 10.5, 4.8, 4.3, 1) },
  { region: "plecy", views: BACK, shape: rect(9.3, 6, 5.4, 6.3, 1.4) },
  {
    region: "plecy",
    views: BACK,
    shape: { kind: "line", x1: 12, y1: 6.8, x2: 12, y2: 11.5 },
  },
  { region: "ramiona", views: BOTH, shape: rect(5.6, 9.3, 2.6, 5.6, 1.3) },
  { region: "ramiona", views: BOTH, shape: rect(15.8, 9.3, 2.6, 5.6, 1.3) },
  { region: "posladki", views: BACK, shape: rect(9.3, 13, 2.4, 2.5, 1.2) },
  { region: "posladki", views: BACK, shape: rect(12.3, 13, 2.4, 2.5, 1.2) },
  { region: "uda", views: FRONT, shape: rect(9.3, 15.5, 2.4, 4.9, 1.2) },
  { region: "uda", views: FRONT, shape: rect(12.3, 15.5, 2.4, 4.9, 1.2) },
  { region: "uda", views: BACK, shape: rect(9.3, 16.2, 2.4, 4.3, 1.2) },
  { region: "uda", views: BACK, shape: rect(12.3, 16.2, 2.4, 4.3, 1.2) },
  { region: "lydki", views: BOTH, shape: rect(9.5, 21, 2, 2.6, 1) },
  { region: "lydki", views: BOTH, shape: rect(12.5, 21, 2, 2.6, 1) },
];

const GROUP_TO_REGION: Record<PlanDayMuscleGroupId, GlyphRegion> = {
  klatka: "klatka",
  plecy: "plecy",
  barki: "barki",
  ramiona: "ramiona",
  nogi: "uda",
  posladki: "posladki",
  lydki: "lydki",
  brzuch: "brzuch",
};

const SIZE_PX = { row: 32, hero: 64 } as const;

const BASE_CLASS = "fill-[var(--gym-glyph-base)] stroke-[var(--gym-glyph-stroke)]";
const ON_CLASS = "fill-[var(--gym-gold)] stroke-[var(--gym-gold-deep)]";
const SPINE_BASE_CLASS = "stroke-[var(--gym-glyph-stroke)]";
const SPINE_ON_CLASS = "stroke-[var(--gym-gold-deep)]";

function GlyphShape({ part, on }: { part: GlyphPart; on: boolean }) {
  const { shape } = part;
  if (shape.kind === "line") {
    return (
      <line
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={on ? SPINE_ON_CLASS : SPINE_BASE_CLASS}
        data-glyph-on={on || undefined}
      />
    );
  }
  const className = on ? ON_CLASS : BASE_CLASS;
  if (shape.kind === "circle") {
    return (
      <circle
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        vectorEffect="non-scaling-stroke"
        className={className}
      />
    );
  }
  return (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      rx={shape.rx}
      vectorEffect="non-scaling-stroke"
      className={className}
      data-glyph-region={part.region ?? undefined}
      data-glyph-on={on || undefined}
    />
  );
}

export function MuscleGlyph({
  summary,
  size,
  className,
}: {
  /** `null` = brak rozpoznanych partii → ikona sztangi (AC-3.8). */
  summary: PlanDayMuscleSummary | null;
  size: "row" | "hero";
  className?: string;
}) {
  if (!summary || summary.groups.length === 0) {
    if (size === "hero") {
      return (
        <span
          aria-hidden
          className={cn(
            "flex size-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[var(--gym-surface-raised)]",
            className,
          )}
        >
          <Dumbbell className="size-8 text-white/60" strokeWidth={2} />
        </span>
      );
    }
    return (
      <Dumbbell
        aria-hidden
        className={cn("size-5 text-white/60", className)}
        strokeWidth={2}
      />
    );
  }

  const highlighted = new Set(summary.groups.map((g) => GROUP_TO_REGION[g]));
  const px = SIZE_PX[size];

  return (
    <svg
      aria-hidden
      focusable="false"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      strokeWidth={1}
      data-glyph-view={summary.view}
      className={cn("shrink-0", className)}
    >
      {GLYPH_PARTS.filter((part) => part.views.includes(summary.view)).map(
        (part, i) => (
          <GlyphShape
            key={i}
            part={part}
            on={part.region != null && highlighted.has(part.region)}
          />
        ),
      )}
    </svg>
  );
}

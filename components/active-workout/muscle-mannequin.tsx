"use client";

import { cn } from "@/lib/utils";
import type { MuscleRegionId } from "@/lib/resolve-exercise-muscles";

const BASE = "#6b6b6f";
const BASE_STROKE = "rgba(255,255,255,0.12)";
const PRIMARY = "#e85a2a";
const SECONDARY = "rgba(232,90,42,0.42)";

function fillFor(
  id: MuscleRegionId,
  primary: MuscleRegionId | null,
  secondary: MuscleRegionId[],
): string {
  if (primary === id) return PRIMARY;
  if (secondary.includes(id)) return SECONDARY;
  return BASE;
}

function FrontFigure({
  primary,
  secondary,
}: {
  primary: MuscleRegionId | null;
  secondary: MuscleRegionId[];
}) {
  const f = (id: MuscleRegionId) => fillFor(id, primary, secondary);
  return (
    <svg
      viewBox="0 0 200 420"
      className="h-full w-full"
      aria-hidden
      role="img"
    >
      {/* Head */}
      <ellipse cx="100" cy="28" rx="22" ry="26" fill={BASE} stroke={BASE_STROKE} />
      {/* Neck */}
      <rect x="90" y="50" width="20" height="18" rx="4" fill={BASE} />
      {/* Torso silhouette */}
      <path
        d="M62 72 C55 95 52 130 54 165 L58 230 C60 250 70 268 100 272 C130 268 140 250 142 230 L146 165 C148 130 145 95 138 72 Z"
        fill="#4a4a4e"
        stroke={BASE_STROKE}
      />
      {/* Chest L/R */}
      <path
        d="M68 88 C78 78 92 78 100 92 C92 108 78 112 68 104 Z"
        fill={f("chest")}
        stroke={BASE_STROKE}
      />
      <path
        d="M132 88 C122 78 108 78 100 92 C108 108 122 112 132 104 Z"
        fill={f("chest")}
        stroke={BASE_STROKE}
      />
      {/* Core / abs */}
      <path
        d="M82 118 L118 118 L116 210 C110 230 90 230 84 210 Z"
        fill={f("core")}
        stroke={BASE_STROKE}
      />
      {/* Shoulders */}
      <ellipse cx="58" cy="86" rx="18" ry="14" fill={f("shoulders")} stroke={BASE_STROKE} />
      <ellipse cx="142" cy="86" rx="18" ry="14" fill={f("shoulders")} stroke={BASE_STROKE} />
      {/* Upper arms — biceps front */}
      <path
        d="M42 96 C34 110 32 140 36 168 L52 168 C54 140 54 112 50 98 Z"
        fill={f("biceps")}
        stroke={BASE_STROKE}
      />
      <path
        d="M158 96 C166 110 168 140 164 168 L148 168 C146 140 146 112 150 98 Z"
        fill={f("biceps")}
        stroke={BASE_STROKE}
      />
      {/* Forearms front */}
      <path
        d="M36 170 C30 190 28 220 34 248 L50 244 C48 220 48 192 50 172 Z"
        fill={f("forearms")}
        stroke={BASE_STROKE}
      />
      <path
        d="M164 170 C170 190 172 220 166 248 L150 244 C152 220 152 192 150 172 Z"
        fill={f("forearms")}
        stroke={BASE_STROKE}
      />
      {/* Hands */}
      <ellipse cx="40" cy="258" rx="10" ry="12" fill={BASE} />
      <ellipse cx="160" cy="258" rx="10" ry="12" fill={BASE} />
      {/* Quads */}
      <path
        d="M72 272 C68 300 66 340 70 370 L94 372 C96 340 96 300 94 274 Z"
        fill={f("quads")}
        stroke={BASE_STROKE}
      />
      <path
        d="M128 272 C132 300 134 340 130 370 L106 372 C104 340 104 300 106 274 Z"
        fill={f("quads")}
        stroke={BASE_STROKE}
      />
      {/* Calves front (tibialis area — show calves highlight here too) */}
      <path
        d="M74 374 C72 390 72 405 76 418 L92 416 C90 400 90 388 92 376 Z"
        fill={f("calves")}
        stroke={BASE_STROKE}
      />
      <path
        d="M126 374 C128 390 128 405 124 418 L108 416 C110 400 110 388 108 376 Z"
        fill={f("calves")}
        stroke={BASE_STROKE}
      />
    </svg>
  );
}

function BackFigure({
  primary,
  secondary,
}: {
  primary: MuscleRegionId | null;
  secondary: MuscleRegionId[];
}) {
  const f = (id: MuscleRegionId) => fillFor(id, primary, secondary);
  return (
    <svg
      viewBox="0 0 200 420"
      className="h-full w-full"
      aria-hidden
      role="img"
    >
      <ellipse cx="100" cy="28" rx="22" ry="26" fill={BASE} stroke={BASE_STROKE} />
      <rect x="90" y="50" width="20" height="18" rx="4" fill={BASE} />
      <path
        d="M62 72 C55 95 52 130 54 165 L58 230 C60 250 70 268 100 272 C130 268 140 250 142 230 L146 165 C148 130 145 95 138 72 Z"
        fill="#4a4a4e"
        stroke={BASE_STROKE}
      />
      {/* Upper back / traps+lats */}
      <path
        d="M70 78 C82 70 118 70 130 78 L136 130 C120 150 80 150 64 130 Z"
        fill={f("back_upper")}
        stroke={BASE_STROKE}
      />
      {/* Mid back */}
      <path
        d="M68 132 C84 148 116 148 132 132 L128 178 C112 190 88 190 72 178 Z"
        fill={f("back_mid")}
        stroke={BASE_STROKE}
      />
      {/* Lower back */}
      <path
        d="M76 180 C92 194 108 194 124 180 L120 230 C108 242 92 242 80 230 Z"
        fill={f("back_lower")}
        stroke={BASE_STROKE}
      />
      {/* Shoulders rear */}
      <ellipse cx="58" cy="86" rx="18" ry="14" fill={f("shoulders")} stroke={BASE_STROKE} />
      <ellipse cx="142" cy="86" rx="18" ry="14" fill={f("shoulders")} stroke={BASE_STROKE} />
      {/* Triceps (rear arms) */}
      <path
        d="M42 96 C34 110 32 140 36 168 L52 168 C54 140 54 112 50 98 Z"
        fill={f("triceps")}
        stroke={BASE_STROKE}
      />
      <path
        d="M158 96 C166 110 168 140 164 168 L148 168 C146 140 146 112 150 98 Z"
        fill={f("triceps")}
        stroke={BASE_STROKE}
      />
      <path
        d="M36 170 C30 190 28 220 34 248 L50 244 C48 220 48 192 50 172 Z"
        fill={f("forearms")}
        stroke={BASE_STROKE}
      />
      <path
        d="M164 170 C170 190 172 220 166 248 L150 244 C152 220 152 192 150 172 Z"
        fill={f("forearms")}
        stroke={BASE_STROKE}
      />
      <ellipse cx="40" cy="258" rx="10" ry="12" fill={BASE} />
      <ellipse cx="160" cy="258" rx="10" ry="12" fill={BASE} />
      {/* Glutes */}
      <path
        d="M74 248 C88 242 112 242 126 248 L128 278 C112 290 88 290 72 278 Z"
        fill={f("glutes")}
        stroke={BASE_STROKE}
      />
      {/* Hamstrings */}
      <path
        d="M72 280 C68 310 66 345 72 372 L94 370 C96 340 96 308 94 282 Z"
        fill={f("hamstrings")}
        stroke={BASE_STROKE}
      />
      <path
        d="M128 280 C132 310 134 345 128 372 L106 370 C104 340 104 308 106 282 Z"
        fill={f("hamstrings")}
        stroke={BASE_STROKE}
      />
      {/* Calves rear */}
      <path
        d="M74 374 C70 392 70 408 76 418 L94 414 C92 400 92 388 92 376 Z"
        fill={f("calves")}
        stroke={BASE_STROKE}
      />
      <path
        d="M126 374 C130 392 130 408 124 418 L106 414 C108 400 108 388 108 376 Z"
        fill={f("calves")}
        stroke={BASE_STROKE}
      />
    </svg>
  );
}

export function MuscleMannequin({
  primary,
  secondary = [],
  preferBackView = false,
  label,
  className,
}: {
  primary: MuscleRegionId | null;
  secondary?: MuscleRegionId[];
  preferBackView?: boolean;
  label?: string | null;
  className?: string;
}) {
  if (!primary || primary === "cardio") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        className,
      )}
      role="img"
      aria-label={
        label
          ? `Partia mięśniowa następnego ćwiczenia: ${label}`
          : "Partia mięśniowa następnego ćwiczenia"
      }
    >
      <div className="flex items-end justify-center gap-3">
        <div
          className={cn(
            "h-[168px] w-[80px] sm:h-[196px] sm:w-[94px]",
            preferBackView && "opacity-45",
          )}
        >
          <FrontFigure primary={primary} secondary={secondary} />
        </div>
        <div
          className={cn(
            "h-[168px] w-[80px] sm:h-[196px] sm:w-[94px]",
            !preferBackView && "opacity-45",
          )}
        >
          <BackFigure primary={primary} secondary={secondary} />
        </div>
      </div>
      {label ? (
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          {label}
        </p>
      ) : null}
    </div>
  );
}

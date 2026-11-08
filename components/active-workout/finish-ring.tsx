import { cn } from "@/lib/utils";

/**
 * Pierścień końca treningu (makieta „Koniec treningu”): `loading` = złoty łuk
 * obracający się podczas zapisu, `done` = pierścień dorysowuje się, a po nim znacznik.
 * Animacje w CSS (`gym-finish-*` w globals.css), bez JS i z obsługą reduced-motion.
 */
export function FinishRing({
  mode,
  className,
}: {
  mode: "loading" | "done";
  className?: string;
}) {
  return (
    <div className={cn("relative h-[132px] w-[132px]", className)} aria-hidden>
      <div className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(230,201,135,0.22)_0%,transparent_65%)]" />
      <svg viewBox="0 0 180 180" className="relative h-full w-full">
        <circle cx="90" cy="90" r="78" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        {mode === "loading" ? (
          <g className="gym-finish-spin" style={{ transformOrigin: "90px 90px" }}>
            <circle
              cx="90"
              cy="90"
              r="78"
              fill="none"
              stroke="var(--gym-gold-bright)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="130 360"
            />
          </g>
        ) : (
          <>
            <circle
              className="gym-finish-draw"
              style={{ "--len": 490 } as React.CSSProperties}
              cx="90"
              cy="90"
              r="78"
              fill="none"
              stroke="var(--gym-gold-bright)"
              strokeWidth="6"
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
            />
            <path
              className="gym-finish-draw"
              style={{ "--len": 120, "--finish-delay": "550ms" } as React.CSSProperties}
              d="M58 92 L81 114 L124 66"
              fill="none"
              stroke="var(--gym-gold-bright)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

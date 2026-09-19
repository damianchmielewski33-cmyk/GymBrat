export function MetalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* ── Base: near-pure black ── */}
      <div className="absolute inset-0 bg-[#070708]" />

      {/* ── Hexagonal rubber-mat grid (gold tint) ── */}
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: [
            "linear-gradient(30deg,rgba(212,175,55,1) 12%,transparent 12.5%,transparent 87%,rgba(212,175,55,1) 87.5%,rgba(212,175,55,1))",
            "linear-gradient(150deg,rgba(212,175,55,1) 12%,transparent 12.5%,transparent 87%,rgba(212,175,55,1) 87.5%,rgba(212,175,55,1))",
            "linear-gradient(30deg,rgba(212,175,55,1) 12%,transparent 12.5%,transparent 87%,rgba(212,175,55,1) 87.5%,rgba(212,175,55,1))",
            "linear-gradient(150deg,rgba(212,175,55,1) 12%,transparent 12.5%,transparent 87%,rgba(212,175,55,1) 87.5%,rgba(212,175,55,1))",
            "linear-gradient(60deg,rgba(212,175,55,1) 25%,transparent 25.5%,transparent 75%,rgba(212,175,55,1) 75%,rgba(212,175,55,1))",
            "linear-gradient(60deg,rgba(212,175,55,1) 25%,transparent 25.5%,transparent 75%,rgba(212,175,55,1) 75%,rgba(212,175,55,1))",
          ].join(","),
          backgroundSize: "44px 76px",
          backgroundPosition: "0 0,0 0,22px 38px,22px 38px,0 0,22px 38px",
        }}
      />

      {/* ══════════════════════════════════════════════
          GYM EQUIPMENT SILHOUETTES — gold chrome
          ══════════════════════════════════════════════ */}

      {/* Large olympic barbell — upper right, angled */}
      <div className="absolute -right-20 top-[6%] w-[620px] opacity-[0.11] rotate-[13deg] origin-right">
        <svg
          viewBox="0 0 720 92"
          fill="#d4af37"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="4" width="46" height="84" rx="6" />
          <rect x="46" y="14" width="26" height="64" rx="5" />
          <rect x="72" y="22" width="16" height="48" rx="4" />
          <rect x="88" y="30" width="16" height="32" rx="4" />
          <rect x="104" y="39" width="512" height="14" rx="7" />
          <rect x="616" y="30" width="16" height="32" rx="4" />
          <rect x="632" y="22" width="16" height="48" rx="4" />
          <rect x="648" y="14" width="26" height="64" rx="5" />
          <rect x="674" y="4" width="46" height="84" rx="6" />
        </svg>
      </div>

      {/* Weight plate ring — large, bottom-left corner */}
      <div className="absolute -bottom-28 -left-28 w-[460px] opacity-[0.12] gold-plate-spin">
        <svg
          viewBox="0 0 220 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="110" cy="110" r="104" stroke="#d4af37" strokeWidth="8" />
          <circle cx="110" cy="110" r="87" stroke="#e8c547" strokeWidth="4" />
          <circle cx="110" cy="110" r="70" stroke="#d4af37" strokeWidth="2.5" />
          <circle cx="110" cy="110" r="20" stroke="#e8c547" strokeWidth="6" />
          <rect x="97" y="6" width="26" height="12" rx="6" fill="#d4af37" />
          <rect x="97" y="202" width="26" height="12" rx="6" fill="#d4af37" />
          <rect x="6" y="97" width="12" height="26" rx="6" fill="#d4af37" />
          <rect x="202" y="97" width="12" height="26" rx="6" fill="#d4af37" />
        </svg>
      </div>

      {/* Dumbbell — left side, mid-height */}
      <div className="absolute left-[1%] top-[50%] w-[280px] opacity-[0.10] -rotate-[18deg]">
        <svg
          viewBox="0 0 300 64"
          fill="#d4af37"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="5" width="30" height="54" rx="5" />
          <rect x="30" y="13" width="18" height="38" rx="4" />
          <rect x="48" y="21" width="10" height="22" rx="3" />
          <rect x="58" y="28" width="184" height="8" rx="4" />
          <rect x="242" y="21" width="10" height="22" rx="3" />
          <rect x="252" y="13" width="18" height="38" rx="4" />
          <rect x="270" y="5" width="30" height="54" rx="5" />
        </svg>
      </div>

      {/* Small weight plate — upper centre-right */}
      <div className="absolute right-[22%] top-[4%] w-[130px] opacity-[0.09] rotate-[8deg]">
        <svg
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="100" cy="100" r="94" stroke="#d4af37" strokeWidth="8" />
          <circle cx="100" cy="100" r="76" stroke="#e8c547" strokeWidth="3.5" />
          <circle cx="100" cy="100" r="20" stroke="#d4af37" strokeWidth="5" />
        </svg>
      </div>

      {/* Kettlebell — right side, lower */}
      <div className="absolute right-[4%] bottom-[18%] w-[160px] opacity-[0.10] rotate-[6deg]">
        <svg
          viewBox="0 0 130 155"
          fill="#d4af37"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M38 72 Q36 22 65 14 Q94 22 92 72"
            fill="none"
            stroke="#e8c547"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <ellipse cx="65" cy="105" rx="52" ry="46" />
          <ellipse cx="65" cy="143" rx="40" ry="9" />
        </svg>
      </div>

      {/* Power rack upright silhouette — far left */}
      <div className="absolute -left-4 top-[12%] h-[70%] w-16 opacity-[0.07]">
        <svg viewBox="0 0 40 400" fill="#d4af37" className="h-full w-full">
          <rect x="14" y="0" width="12" height="400" rx="2" />
          {[40, 90, 140, 190, 240, 290, 340].map((y) => (
            <rect key={y} x="4" y={y} width="32" height="6" rx="1" />
          ))}
        </svg>
      </div>

      {/* Second barbell — bottom area */}
      <div className="absolute -bottom-8 left-[15%] w-[400px] opacity-[0.08] -rotate-[5deg]">
        <svg
          viewBox="0 0 500 60"
          fill="#d4af37"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="2" width="32" height="56" rx="4" />
          <rect x="32" y="10" width="18" height="40" rx="3" />
          <rect x="50" y="22" width="8" height="16" rx="2" />
          <rect x="58" y="26" width="384" height="8" rx="4" />
          <rect x="442" y="22" width="8" height="16" rx="2" />
          <rect x="450" y="10" width="18" height="40" rx="3" />
          <rect x="468" y="2" width="32" height="56" rx="4" />
        </svg>
      </div>

      {/* ══════════════════════════════════════════════
          LIGHTING & ATMOSPHERE — black & gold
          ══════════════════════════════════════════════ */}

      {/* Championship gold spotlight — top-left */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_1600px_1000px_at_-8%_-14%,rgba(212,175,55,0.28),transparent_58%)]" />

      {/* Warm gold ember — bottom centre */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_1000px_600px_at_50%_112%,rgba(166,133,32,0.16),transparent_62%)]" />

      {/* Diagonal gym-floor hazard stripes — gold */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg,rgba(212,175,55,1) 0px,rgba(212,175,55,1) 2px,transparent 2px,transparent 58px)",
        }}
      />

      {/* Metal grating — horizontal scanlines */}
      <div
        className="absolute inset-0 opacity-[0.065]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.20) 3px,rgba(255,255,255,0.20) 4px)",
        }}
      />

      {/* Conic ambient spin */}
      <div className="absolute -inset-[40%] opacity-38 blur-3xl conic-spin" />

      {/* Animated metal sheen */}
      <div className="absolute inset-0 opacity-[0.13] metal-surface animated-ambient" />

      {/* Film grain / chalk dust */}
      <div className="absolute inset-0 opacity-[0.11] grain-overlay" />

      {/* Heavy vignette — dark edges like a gym spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(0,0,0,0.72)_100%)]" />
    </div>
  );
}

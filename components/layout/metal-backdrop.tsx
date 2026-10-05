export function MetalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#040405]"
    >
      {/* Głęboki gradient bazowy — niejednolita czerń */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(120% 80% at 50% -10%, #141318 0%, transparent 55%)",
            "radial-gradient(90% 70% at 100% 100%, #0c0a08 0%, transparent 50%)",
            "linear-gradient(180deg, #070708 0%, #040405 45%, #060504 100%)",
          ].join(", "),
        }}
      />

      {/* Wolno dryfujące ciepłe światła */}
      <div className="app-ambient-orb app-ambient-orb--a" />
      <div className="app-ambient-orb app-ambient-orb--b" />
      <div className="app-ambient-orb app-ambient-orb--c" />

      {/* Delikatna siatka / struktura metalu */}
      <div className="app-ambient-mesh absolute inset-0 opacity-[0.035]" />

      {/* Winieta — skupia uwagę na treści */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 65% at 50% 40%, transparent 35%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <div className="absolute inset-0 grain-overlay opacity-[0.12]" />
    </div>
  );
}

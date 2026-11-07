/** Pozycje iskier: [left %, top vh, opóźnienie s, czas s]. */
const SPARKS: Array<[number, number, number, number]> = [
  [10, 70, 0, 9],
  [86, 55, 2, 12],
  [46, 82, 4, 10],
  [92, 38, 1, 13],
  [6, 30, 5, 11],
  [64, 90, 3, 9],
  [26, 20, 6, 14],
  [78, 72, 2, 12],
];

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

      {/* Obracające się złote stożki światła */}
      <div className="app-bg-cone app-bg-cone--a" />
      <div className="app-bg-cone app-bg-cone--b" />

      {/* Wolno dryfujące ciepłe światła */}
      <div className="app-ambient-orb app-ambient-orb--a" />
      <div className="app-ambient-orb app-ambient-orb--b" />
      <div className="app-ambient-orb app-ambient-orb--c" />

      {/* Pulsujące poświaty */}
      <div className="app-bg-glow left-[8%] top-[48%] h-[300px] w-[300px]" />
      <div
        className="app-bg-glow right-[-10%] top-[8%] h-[260px] w-[260px]"
        style={{ animationDelay: "3s" }}
      />

      {/* Siatka (powoli przesuwana) i struktura metalu */}
      <div className="app-bg-grid" />
      <div className="app-ambient-mesh absolute inset-0 opacity-[0.035]" />

      {/* Smuga światła przesuwająca się w dół */}
      <div className="app-bg-beam" />

      {/* Unoszące się złote iskry */}
      {SPARKS.map(([left, top, delay, dur], i) => (
        <span
          key={i}
          className="app-bg-spark"
          style={{
            left: `${left}%`,
            top: `${top}vh`,
            animationDelay: `${delay}s`,
            animationDuration: `${dur}s`,
          }}
        />
      ))}

      {/* Winieta — skupia uwagę na treści */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 65% at 50% 40%, transparent 35%, rgba(0,0,0,0.38) 100%)",
        }}
      />

      <div className="absolute inset-0 grain-overlay opacity-[0.12]" />
    </div>
  );
}

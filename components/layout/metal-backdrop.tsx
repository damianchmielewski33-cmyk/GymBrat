export function MetalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#f4f5f7]" />

      {/* Soft teal / sky wash — jak marketplace AWP */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 900px 520px at 8% -10%, rgba(0,201,177,0.16), transparent 60%)",
            "radial-gradient(ellipse 700px 480px at 100% 0%, rgba(14,165,233,0.10), transparent 55%)",
            "radial-gradient(ellipse 800px 500px at 50% 110%, rgba(26,45,90,0.06), transparent 55%)",
          ].join(","),
        }}
      />

      {/* Subtelne linie boiska */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage: 'var(--awp-bg-pitch-lines, url("/pitch-lines.svg"))',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="absolute inset-0 opacity-[0.04] grain-overlay" />
    </div>
  );
}

export function MetalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050505]"
    >
      <div className="absolute inset-0 metal-surface animated-ambient opacity-90" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(900px 620px at 18% 8%, rgba(235, 196, 74, 0.14), transparent 58%)",
            "radial-gradient(780px 560px at 82% 22%, rgba(196, 154, 31, 0.10), transparent 55%)",
            "radial-gradient(700px 520px at 48% 78%, rgba(235, 196, 74, 0.08), transparent 60%)",
            "radial-gradient(520px 420px at 70% 92%, rgba(120, 80, 30, 0.12), transparent 55%)",
          ].join(", "),
        }}
      />
      <div className="absolute inset-0 grain-overlay opacity-[0.18]" />
    </div>
  );
}

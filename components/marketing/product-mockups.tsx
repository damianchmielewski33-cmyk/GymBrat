/**
 * Z76: makiety ekranów z komponentów (nie prawdziwe zrzuty) — dane przykładowe, wyraźnie oznaczone.
 * Gdy będą prawdziwe zrzuty z aplikacji, podmień ten komponent na <Image>.
 */
function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="app-card space-y-3 p-4" aria-label={`Makieta ekranu: ${title}`}>
      <figcaption className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
        {title}
      </figcaption>
      {children}
      <p className="text-[11px] text-white/50">Przykładowe dane — makieta ekranu.</p>
    </figure>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/85">
      <span>{left}</span>
      <span className="font-semibold text-white">{right}</span>
    </div>
  );
}

export function ProductMockups() {
  const bars = [38, 52, 46, 64, 58, 76, 70];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Frame title="Trening na dziś">
        <div className="space-y-1.5">
          <Row left="Wyciskanie sztangi leżąc" right="4 × 8" />
          <Row left="Podciąganie" right="3 × 10" />
          <Row left="Wiosłowanie" right="3 × 10" />
        </div>
      </Frame>
      <Frame title="Progres">
        <div className="flex h-24 items-end gap-1.5" aria-hidden>
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-[var(--gym-gold)]/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <p className="text-sm text-white/70">Tonaż tygodniowy rośnie z sesji na sesję.</p>
      </Frame>
    </div>
  );
}

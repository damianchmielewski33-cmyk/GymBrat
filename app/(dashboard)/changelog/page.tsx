import Link from "next/link";

const entries = [
  {
    title: "2026-05 — stabilność i dostępność",
    bullets: [
      "Limitowanie zapytań API (trening, raporty, panel admina).",
      "Dziennik zmian w panelu administratora (AI globalnie, role, dostęp do AI).",
      "Briefing i analiza: spójne fallbacki bez modelu AI.",
      "Eksport danych JSON/CSV w profilu; checklista pierwszych kroków na Start.",
      "Powiadomienia PWA (gdy karta otwarta) — ustawienia w profilu.",
    ],
  },
  {
    title: "Planowane",
    bullets: [
      "Szersze testy E2E i offline queue dla sesji treningowej.",
      "Opcjonalna wielojęzyczność interfejsu.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Produkt
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Nowości i plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Krótki changelog GymBrat — aktualizujemy go wraz z wdrożeniami. Pełna kopia danych:
          <Link href="/profile#export-data" className="ml-1 text-[var(--neon)] underline">
            Profil → eksport
          </Link>
          .
        </p>
      </header>

      <div className="space-y-6">
        {entries.map((e) => (
          <section key={e.title} className="glass-panel neon-glow p-6">
            <h2 className="font-heading text-lg font-semibold text-white">{e.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/75">
              {e.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

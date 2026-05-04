export type ChangelogEntry = {
  title: string;
  bullets: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    title: "2026-05 — stabilność, dostępność, offline",
    bullets: [
      "Limitowanie zapytań API (trening, raporty, panel admina).",
      "Dziennik zmian w panelu administratora (AI globalnie, role, dostęp do AI).",
      "Briefing i analiza: spójne fallbacki bez modelu AI; bez brandingu „Trener AI”, gdy konto nie ma uprawnień.",
      "Czat trenera ukryty, gdy AI jest wyłączone globalnie i nie skonfigurowano wyszukiwarki (Custom Search).",
      "Kolejka zapisu treningu przy braku sieci (IndexedDB) — automatyczna synchronizacja po powrocie online.",
      "Eksport JSON/CSV w profilu; checklista pierwszych kroków na Start.",
      "Powiadomienia PWA (gdy karta otwarta) — ustawienia w profilu.",
      "Szkielet i18n (np. nawigacja) — rozszerzalny na kolejne języki.",
    ],
  },
  {
    title: "Planowane",
    bullets: [
      "Szersze testy E2E i synchronizacja sesji między urządzeniami.",
      "Rozbudowa słowników tłumaczeń (pełne pokrycie UI).",
    ],
  },
];

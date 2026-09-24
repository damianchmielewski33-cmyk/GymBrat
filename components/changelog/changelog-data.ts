import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";
import type { ChangelogSourceEntry } from "@/lib/deploy-changelog";

export type ChangelogEntry = ChangelogSourceEntry;

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    title: "2026-09 — analytics i WebView Android bez błędu Origin",
    date: "2026-09-24",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "POST /api/analytics/page-view akceptuje własne pochodzenie GymBrat (https://gym-brat.vercel.app) oraz Akademię, zamiast odpowiadać 403 przy nagłówku Origin.",
      "Przy niedozwolonym Origin albo błędzie zapisu analytics zwraca cichy 204, żeby Android WebView nie pokazywał okienka z komunikatem o liście dozwolonych adresów.",
      "CSP frame-ancestors nadal pozwala osadzić GymBrat w Akademii oraz lokalnie na localhost:3000 i 127.0.0.1:3000.",
    ],
  },
  {
    title: "2026-09 — nowy ekran Start i wymiary w raporcie",
    date: "2026-09-19",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Ekran Start pokazuje powitanie z imieniem, następny trening z przyciskiem Rozpocznij oraz mini-statystyki tygodnia i serii.",
      "Na Starcie są kafle Waga, Tempo i Waga od startu oraz liniowy wykres masy z zakresami od tygodnia do roku.",
      "Sekcja Twoja przemiana porównuje pierwsze i ostatnie zdjęcie z raportów suwakiem, a kafle wymiarów pokazują wagę, pas, ramię i brzuch.",
      "Ze Startu usunięto stare kafle posiłków, makro, check-inu i deficytu — te dane zostają w innych ekranach aplikacji.",
      "W raporcie można zapisać obwód ramienia i brzucha (pola armCm oraz abdomenCm) obok dotychczasowych pomiarów.",
    ],
  },
  {
    title: "2026-09 — poprawki produkcji (Analiza, Android, PWA, UI)",
    date: "2026-09-19",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Naprawiony crash po wejściu w Analizę (kolejność hooków w CoachChatFab).",
      "Stary service worker next-pwa jest wyrejestrowywany, żeby produkcja nie trzymała poprzedniego UI.",
      "GET /api/android/version i /android-version.json są publiczne — aplikacja Android pobiera wersję bez logowania.",
      "Ekrany w aplikacji korzystają z tego samego czarno-złotego języka co logowanie.",
      "Akademia znowu może osadzić GymBrat w iframe (CSP frame-ancestors), bez linków siostrzanych w samym GymBrat.",
    ],
  },
  {
    title: "2026-09 — nadzór wdrożeń z repozytorium GymBrat",
    date: "2026-09-19",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Agent Deploy Guardian pilnuje, żeby wdrożenie szło wyłącznie z github.com/damianchmielewski33-cmyk/GymBrat.",
      "Każda zmiana widoczna dla użytkownika musi mieć jasny, pełnozdaniowy opis w changelogu tej aplikacji.",
      "Publiczny GET /api/version pokazuje commit, gałąź i zaufanie źródła z tego repozytorium — nie z AWP.",
      "CI blokuje PR-y, które ruszają UI bez aktualizacji changelogu albo pochodzą spoza repozytorium GymBrat.",
    ],
  },
  {
    title: "2026-09 — start i osadzanie w Akademii",
    date: "2026-09-18",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: "06820a0",
    bullets: [
      "Strona startowa i logowanie dostały czarno-złoty motyw ze zdjęciami siłowni (commit 15fe94f z tego repo).",
      "Akademia może osadzić GymBrat w iframe — nagłówki i CSP pochodzą z repozytorium GymBrat, nie z AWP.",
    ],
  },
  {
    title: "2026-05 — stabilność, dostępność, offline",
    date: "2026-05",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
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
    planned: true,
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    bullets: [
      "Szersze testy E2E i synchronizacja sesji między urządzeniami.",
      "Rozbudowa słowników tłumaczeń (pełne pokrycie UI).",
    ],
  },
];

import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";
import type { ChangelogSourceEntry } from "@/lib/deploy-changelog";

export type ChangelogEntry = ChangelogSourceEntry;

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    title: "2026-09 — postępy: ekran ćwiczenia, prognozy, milestones, NOWY MAX",
    date: "2026-09-28",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "W Analizie jest dedykowany ekran ćwiczenia z historią e1RM, tonażem i prognozą siły na 28 dni.",
      "Kamienie milowe łączą cele z profilu z aktualnymi rekordami i postępem tygodniowym.",
      "Po nowym rekordzie w trakcie treningu pojawia się ekran świętowania NOWY MAX.",
    ],
  },
  {
    title: "2026-09 — trening: RIR, tempo, superserie, PDF i edycja",
    date: "2026-09-28",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "W sesji treningowej można zapisać RIR, RPE i tempo ruchu oraz otworzyć film techniki ćwiczenia.",
      "Sugestia ciężaru liczy się z ostatniej sesji (RIR/RPE); w planie da się ustawić superserie, tempo i własny link do filmu.",
      "Z historii treningu da się wyeksportować PDF (druk) oraz edytować zapis przez 7 dni od daty sesji.",
    ],
  },
  {
    title: "2026-09 — wymiary i zdjęcie startowe przy rejestracji",
    date: "2026-09-28",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Przy rejestracji konta zbierane są waga, wzrost, wiek oraz obwody pas, brzuch, klatka, ramię i udo — tak jak w raporcie sylwetki.",
      "Można dodać opcjonalne zdjęcie startowe, które trafia do pierwszego raportu i suwaka przemiany.",
      "Po utworzeniu konta zapisujemy wagę startową w historii ważenia oraz raport startowy z wymiarami.",
    ],
  },
  {
    title: "2026-09 — aktualizacja Android tylko z GymBrat",
    date: "2026-09-28",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Sprawdzanie wersji APK i pobieranie aktualizacji bierze dane wyłącznie z release’ów GymBrat, a nie z Akademii Wielkich Piłkarzy.",
      "Wbudowany plik android-version.json ma wersję 0.1.5 i link do gymbrat.apk, żeby komunikat o aktualizacji nie wracał po instalacji.",
    ],
  },
  {
    title: "2026-09 — pulpit: Inny dzień i nowy flow treningu",
    date: "2026-09-28",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Na Starcie lista dni treningowych ma przycisk Inny dzień, oznaczenie w kolejce oraz Start, który od razu uruchamia sesję wybranego dnia.",
      "Główny przycisk Zacznij trening startuje dzień z kolejki; podgląd listy ćwiczeń pokazuje schemat serii i kropki postępu.",
      "Ekran aktywnego treningu prowadzi serię po serii: zaliczanie ciężaru i powtórzeń, potem pełnoekranowa przerwa z presetami czasu, zapamiętaniem przy ćwiczeniu i przyciskiem Dalej.",
      "Z listy ćwiczeń w trakcie sesji widać ukończone (zielone) i bieżące (złote) pozycje oraz można zakończyć lub zresetować trening.",
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

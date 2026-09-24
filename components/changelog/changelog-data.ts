import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";
import type { ChangelogSourceEntry } from "@/lib/deploy-changelog";

export type ChangelogEntry = ChangelogSourceEntry;

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    title: "2026-09 — Android start bez zbędnego 307 na /",
    date: "2026-09-24",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "GET / bez sesji w WebView GymBrat nie robi już 307 na /login w logach Vercel — serwer oddaje ekran logowania przez rewrite (200).",
      "W kodzie APK (android/) start bez sesji idzie od razu na /login, a CookieManager.flush zapisuje sesję NextAuth po restarcie (wymaga przebudowy APK).",
      "Sam 307 dla zwykłej przeglądarki bez logowania nadal jest zamierzony: chronione trasy wymagają konta.",
    ],
  },
  {
    title: "2026-09 — publiczne Asset Links dla Android",
    date: "2026-09-24",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "GET /.well-known/assetlinks.json jest publiczny (bez 307 na logowanie), żeby GoogleAssociationService mógł zweryfikować App Links GymBrat.",
      "Plik zawiera package_name pl.gymbrat.app oraz odcisk SHA-256 certyfikatu podpisu aktualnego gymbrat.apk.",
    ],
  },
  {
    title: "2026-09 — Android WebView bez fałszywego błędu",
    date: "2026-09-24",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Usunięto globalny popup „Zmieniamy się na lepsze”, który w aplikacji Android odpalał się przy zwykłych logach console.error mimo że aplikacja działała.",
      "POST /api/analytics/page-view przy złym Origin zwraca pusty 204 zamiast 403 JSON — WebView nie pokazuje już tego jako strony błędu (w przeglądarce problem nie występował).",
      "Metadane wersji APK to wyłącznie GymBrat 0.1.0 (nie AWP 1.11.5), więc popup „Wymagana aktualizacja” nie blokuje startu zainstalowanej aplikacji.",
      "Plik /gymbrat.apk jest publiczny bez logowania, a allowlista Origin obejmuje gym-brat.vercel.app i same-origin.",
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

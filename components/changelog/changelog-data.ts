import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";
import type { ChangelogSourceEntry } from "@/lib/deploy-changelog";

export type ChangelogEntry = ChangelogSourceEntry;

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    title: "2026-09 — kafelki wagi i wyższy przycisk Raport",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Kafelki Waga, Od startu, Tempo i W programie mają złote ikony, duże liczby i podpisy w stylu ekranu startu — w tym zmianę wagi względem poprzedniego raportu.",
      "Złoty przycisk Raport na dolnej belce siedzi wyżej, w linii z ikonami nawigacji, a nie poniżej ich krawędzi.",
    ],
  },
  {
    title: "2026-09 — kafelki wymiarów jak na ekranie startu",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Kafelki Pas, Udo, Klatka i Ramię na Pulpicie mają wykres obszarowy, dużą liczbę, strzałkę zmiany oraz podpis startu i liczby pomiarów — w układzie zbliżonym do referencyjnego ekranu.",
      "Kolory wykresów (zieleń, błękit, złoto, róż) i typografia wyróżniają każdy wymiar na ciemnym tle karty.",
    ],
  },
  {
    title: "2026-09 — zdjęcia w raporcie wracają do APK",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Po wyborze zdjęcia w galerii telefonu wraca ono do formularza raportu w aplikacji Android — wcześniej galeria się otwierała, ale plik nie trafiał do pola zdjęć.",
      "Zainstaluj GymBrat Android 0.1.3, a na stronie używany jest bezpośredni wybór pliku (bez sztucznego klikania inputa), żeby WebView poprawnie przyjął zdjęcie.",
    ],
  },
  {
    title: "2026-09 — wybór zdjęć w aplikacji Android",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Aplikacja GymBrat na telefonie (WebView) otwiera galerię przy „Wybierz zdjęcia” w raporcie — wcześniej klik w APK nic nie robił, bo brakowało obsługi wyboru pliku.",
      "Zainstaluj aktualizację Android 0.1.2 (versionCode 3), żeby wybór zdjęć sylwetki działał tak jak w przeglądarce na komputerze.",
    ],
  },
  {
    title: "2026-09 — wybór pliku w raporcie znów działa",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Na ekranie Dodaj raport przycisk wyboru zdjęć sylwetki znów otwiera selektor plików — nie jest już przycinany ani zasłonięty przez układ karty.",
      "Ten sam niezawodny wybór pliku działa przy imporcie Excel z historią raportów.",
    ],
  },
  {
    title: "2026-09 — wyraźniejsze złote przyciski",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Przyciski na wszystkich ekranach mają jaśniejsze złoto, metaliczny gradient i wyraźniejszy cień — wyglądają nowocześniej i bardziej wyróżniają się na czarnym tle.",
      "Wspólne style gym-btn-primary, gym-btn-outline i gym-btn-secondary obejmują CTA w nawigacji, na startcie treningu, w diecie, profilu i raportach.",
    ],
  },
  {
    title: "2026-09 — dieta tylko z lokalnej bazy przepisów",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Zakładka Dieta pokazuje przepisy wyłącznie z lokalnej bazy GymBrat — bez generowania przez AI i bez linków z internetu.",
      "Przycisk „Propozycje z bazy” dobiera dania do pory dnia oraz braków białka, węglowodanów i tłuszczu z Twojego planu.",
    ],
  },
  {
    title: "2026-09 — baza posiłków w diecie",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "W zakładce Dieta jest lokalna baza około 590 przepisów z makro (białko, węglowodany, tłuszcz) oraz grafiką i instrukcją przygotowania.",
      "Posiłki są podzielone na śniadanie, drugie śniadanie, obiad, podwieczorek i kolację — możesz filtrować, wyszukiwać i dodawać je do dziennika.",
      "Propozycje dnia i przeglądanie katalogu biorą się z tej samej bazy aplikacji.",
    ],
  },
  {
    title: "2026-09 — aktualizacja APK tylko dla GymBrat",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Popup „Wymagana aktualizacja” porównuje wersję zainstalowanego GymBrat z release’em GymBrat 0.1.1, a nie z wersją 1.11.5 Akademii Wielkich Piłkarzy.",
      "Przycisk aktualizacji pobiera gymbrat.apk z GitHub Release tego repozytorium — instalator Akademii nie jest już podsuwany w aplikacji GymBrat.",
    ],
  },
  {
    title: "2026-09 — start aplikacji bez 307 na logowanie",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Wejście na adres główny bez sesji oddaje ekran logowania z kodem 200 — Vercel i WebView nie widzą już przekierowania 307 na /login.",
      "Tożsamość aplikacji Android jest cache’owana, żeby React nie wpadał w pętlę aktualizacji i nie pokazywał fałszywego błędu przy starcie APK.",
    ],
  },
  {
    title: "2026-09 — bez fałszywego popupu o zmianach",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Aplikacja nie pokazuje już okna „Zmieniamy się na lepsze” przy zwykłym logu w konsoli albo nieudanym zliczeniu wejścia.",
      "Komunikat o awarii pojawia się tylko przy prawdziwym błędzie ekranu i mówi „Coś poszło nie tak”.",
    ],
  },
  {
    title: "2026-09 — analytics page-view z aplikacji Android",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "POST /api/analytics/page-view znów przyjmuje żądania z tego samego hosta (np. gym-brat.vercel.app), także gdy lista Origin w zmiennych środowiskowych nie zawiera aliasu produkcyjnego Vercel.",
      "Beacony z WebView GymBratAndroidApp nie dostają już błędnego 403 przy Sec-Fetch-Site: none — zliczanie wejść w aplikacji Android działa.",
    ],
  },
  {
    title: "2026-09 — pulpit i ekrany jak w aplikacji mobilnej",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Ekrany po zalogowaniu mają czarne tło, płaskie ciemne karty i złote liczby — ten sam rytm co na zdjęciach referencyjnych.",
      "Na dole jest pasek Pulpit, Dieta, Treningi i Wiadomości oraz złoty przycisk Raport na środku.",
      "Start pokazuje powitanie, następny trening z przyciskiem Zacznij trening, wagę, tempo, formę, przemianę i wymiary ze wykresami.",
      "Dieta ma układ planu żywieniowego z kafelkami makro, a logowanie nadal zostaje przy zdjęciu siłowni.",
    ],
  },
  {
    title: "2026-09 — czarno-złoty styl logowania w całej aplikacji",
    date: "2026-09-25",
    sourceRepo: GYMBRAT_GITHUB_SLUG,
    sha: undefined,
    bullets: [
      "Wszystkie ekrany korzystają z tego samego czarno-złotego języka co logowanie: złoty akcent, tło ze zdjęciem siłowni i panelami glass/gold.",
      "Nawigacja, przyciski CTA, wykresy i paski postępu używają tokenów --neon zamiast twardej czerwieni ulicznej.",
      "Marka GymBrat w nagłówku ma ten sam krój display (Bebas) co na ekranie logowania.",
      "Ekran Start ma złoty panel powitalny spójny z resztą aplikacji.",
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

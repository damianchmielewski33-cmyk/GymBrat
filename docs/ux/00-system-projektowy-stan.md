# GymBrat - stan systemu projektowego (baza wiedzy UX)

Stan na 2026-10-23 (uzupełnienie 2026-10-24: komponenty zadania 001). Analiza statyczna kodu (gałąź `feat/error-handling-system`). Dokument opisuje to, co jest, a nie stan docelowy. Liczby w nawiasach to liczba plików `.tsx` w `app/` i `components/`, w których występuje wzorzec.

## 1. Inwentarz ekranów

Grupy tras i ramy:
- `app/layout.tsx` - root: `lang="pl"`, stała klasa `dark`, fonty, `MetalBackdrop`, `AppProviders`, `ActiveWorkoutGlobalBar`.
- `app/(dashboard)/layout.tsx` - zalogowany z pełnym profilem: `AppShell`; niezalogowany lub bez profilu: `AuthPageFrame` (bez nawigacji).
- `app/(auth)/layout.tsx` - `AuthPageFrame`. `app/(legal)/layout.tsx` - dokumenty prawne. `app/admin/layout.tsx` + `app/admin/(panel)/layout.tsx` - `AdminShell`, kontrola roli.

### Użytkownik - rdzeń (dolna belka)
| Ścieżka | Cel | Główne komponenty |
|---|---|---|
| `(dashboard)/page.tsx` (`/`) | Pulpit dnia; dla gościa ekran logowania | `home/home-today-header`, `home/home-today-page-content`, `home/home-header-skeleton`, `auth/login-screen`, `layout/dashboard-route-skeleton` |
| `(dashboard)/workout-plan/page.tsx` | Hub treningów, start sesji | `treningi/workout-plan-page-content` (`treningi-hub*`, `cardio-log-sheet`) |
| `(dashboard)/meal-suggestions/page.tsx` | Hub diety: dziennik, plan, przepisy, skan | `meal-suggestions/meal-suggestions-page-content` (+ `diet-*`, `food-search-scan`, `barcode-camera-scanner`, `food-portion-screen`) |
| `(dashboard)/progress/page.tsx` | Analiza postępów, zakładki `?tab=` | `progress/progress-page-content`, `progress/progress-tabs`, `progress/progress-ui` (spec: `docs/progress-screens.json`) |
| `(dashboard)/community/teams/page.tsx` | Grupy (zakładka "Team") | `community/team-card`, `community/team-invite-forms`, `community/community-empty-state`, `layout/thumb-action-bar`, `AppPageHeader` |

### Trening i cardio
| Ścieżka | Cel | Komponenty |
|---|---|---|
| `active-workout/page.tsx` | Sesja na żywo (pełny ekran, bez belki) | `active-workout/active-workout-view` (`guided-session-layout`, `session-chrome`, `rest-break-screen`, `live-coach-banner`, `ghost-race-hud`, `workout-finished-screen`), `workout/SetRow`, `workout/plate-calculator-sheet` |
| `start-workout/page.tsx` | Przekierowanie na `/workout-plan` | - |
| `workout-history/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx` | Historia, szczegół, korekta sesji | `workout-history/*`, `ScreenHeader` |
| `profile/workout-plan/page.tsx` | Edytor planu | `workout-plan/workout-plan-editor`, `workout-plan-word-import` |
| `cardio/page.tsx`, `cardio/record/page.tsx`, `cardio/[id]/page.tsx` | Hub cardio, nagrywanie trasy (pełny ekran), szczegół | `cardio/cardio-hub-view`, `cardio-record-client`, `cardio-detail-client`, `cardio-route-map` |
| `technique/page.tsx` | Filmy korekty techniki | `technique/technique-videos-client` |

### Żywienie, ciało, postępy
| Ścieżka | Cel | Komponenty |
|---|---|---|
| `nutrition/today/page.tsx`, `nutrition/week/page.tsx` | Podsumowanie makro dnia / tygodnia | `nutrition/nutrition-today-view`, `nutrition-week-view` |
| `supplements/page.tsx` | Suplementy | `supplements/supplements-manage-client` |
| `reports/page.tsx` | Raport ciała (waga, obwody, zdjęcia) + historia | `reports/body-report-form`, `body-report-history`, `queued-workout-banner`, `AppPageHeader` |
| `progress/exercises/[key]/page.tsx` | Szczegół ćwiczenia | `progress/exercise-detail-view` |
| `progress-analysis/page.tsx` | Przekierowanie legacy na `/progress` | - |
| `labs/page.tsx`, `promo-codes/page.tsx` | "W przygotowaniu" | `layout/app-menu-coming-soon` |

### Konto i start
| Ścieżka | Cel | Komponenty |
|---|---|---|
| `(auth)/login`, `(auth)/register` | Logowanie, rejestracja | `auth/login-screen`, `login-form`, `register-form`, `google-sign-in-button`, `role-auth-cards` |
| `(auth)/login/zabezpiecz-konto` | Potwierdzenie przejęcia konta niezweryfikowanego (zadanie 001, UX 4A) | `auth/account-takeover-screen`, `AuthCard`, `AuthHeroBrand compact` |
| `(dashboard)/complete-profile` | Uzupełnienie profilu po OAuth | `auth/complete-profile-form`, `auth-hero-brand`, `auth-session-hydrating` |
| `(dashboard)/onboarding` | Konfiguracja startowa | `ScreenCard`, `ScreenHeading`, `ui/button`, `ui/input`, `ui/label` |
| `(dashboard)/profile` | Profil, parametry ciała, hasło, zgody, język, APK | `profile/*`, `consent/consent-settings-card`, `android-app-version-card`, `AppPageHeader` |
| `(dashboard)/package` | Pakiet użytkownika | `package/package-page-client` |
| `(dashboard)/bug-report`, `inbox` | Zgłoszenie błędu; skrzynka (placeholder, nagłówek inline) | `bug-report/bug-report-form` |
| `(legal)/regulamin`, `(legal)/polityka-prywatnosci` | Dokumenty prawne | `legal/legal-doc-shell` |

### Społeczność (`community/`)
`page.tsx` (hub, `CommunityHubTabs`, `CommunityLevelBanner`), `discover`, `global`, `friends`, `friends/[userId]/live`, `u/[userId]`, `notifications`, `challenges`, `challenges/[challengeId]`, `wars`, `hall-of-fame`, `teams/new`, `teams/join`, `teams/[teamId]` (+ `members`, `settings`, `quests`, `challenges`, `challenges/new`, `challenges/[challengeId]`). Komponenty w `components/community/` (m.in. `activity-feed-list`, `challenge-card`, `challenge-celebration`, `team-subnav`, `wars/wars-hub`, `hof/*`, `quests/*`).

### Administrator (`app/admin/(panel)/`)
`overview`, `users`, `users/[id]`, `users/[id]/edit`, `catalog`, `exercises`, `packages`, `branding`, `bugs`, `settings` - każdy renderuje `components/admin/admin-*-client.tsx`; klocki w `components/admin/admin-ui.tsx`. `app/admin/page.tsx` - "Brak dostępu".

### Stany tras
- `loading.tsx` tylko w `(auth)` i `(dashboard)`. `error.tsx`: `app/`, `(auth)`, `(dashboard)` + `app/global-error.tsx`. `not-found.tsx`: `app/`, `(dashboard)`. Admin nie ma własnych.

## 2. Nawigacja i architektura informacji
- **Dolna belka** (`components/layout/app-shell.tsx`): 5 zakładek z `lib/i18n/messages/pl.ts` - Pulpit `/`, Trening `/workout-plan`, Dieta `/meal-suggestions`, Analiza `/progress`, Team `/community/teams`. Pływająca pigułka `rounded-[30px]`, `bg-black/55 backdrop-blur-2xl`, ikony lucide, etykiety `text-[9px]`/`sm:text-[10px]` uppercase. Aktywna: złota poświata; zakładka Dieta ma osobny kolor `#DDBB6D` i animację `diary-nav-breathe`.
- **FAB "Raport"** wycentrowany nad belką (`/reports?new=1`) na `/`, `/workout-plan`, `/progress`.
- **Nagłówek** sticky (`BrandMark`, `NotificationBell`, `AppMenuButton`); ukryty na `/`. Na `/active-workout` i `/cardio/record` brak nagłówka i belki (pełny ekran); na edycji historii brak belki.
- **Menu boczne** (`components/layout/app-menu-button.tsx`, `Sheet`): grupy Pakiet, Postępy, Społeczność, Trening, Konto - pozycje z tytułem i podtytułem.
- **Szerokość**: jedna kolumna `APP_SHELL_MAX = max-w-lg md:max-w-xl xl:max-w-2xl` na wszystkich szerokościach (brak układu desktopowego dla użytkownika).
- **Admin** (`components/admin/admin-shell.tsx`, `admin-nav.ts`): od `lg` boczny `aside` 236 px w grupach, poniżej poziome zakładki; kontener `max-w-7xl`.
- **Podnawigacje**: `community/community-hub-tabs`, `community/team-subnav`, `progress/progress-tabs`, `community/hof/hof-period-tabs`, `progress-ui` `SegmentedControl` - każda zrobiona osobno.

## 3. Tokeny
Źródło: `app/globals.css` (Tailwind 4, `@theme inline`, bez `tailwind.config`), `components.json` (shadcn styl `base-nova`, baseColor neutral, ikony lucide), fonty w `app/layout.tsx`.

- **Paleta "black iron & gold"**: `--gym-black #070708`, `--gym-app-bg #050505`, powierzchnie `--gym-surface #161616` / `-raised #1c1c1f` / `-sunken #141416`, akcent `--gym-gold #ebc44a` (`-bright #f7e28f`, `-deep #c49a1f`), `--gym-red #e60023`, `--destructive #ff3347`. Aliasy `--neon`, `--neon-rgb`, `--neon-fg`.
- **Semantyka shadcn** (`--background`, `--primary`=złoto, `--muted-foreground` = white 62%, `--border` = white 10%, `--ring`) i `--chart-1..5` (złoto + biele) - **`--chart-*` nie są nigdzie używane** w komponentach; wykresy Recharts mają kolory wpisane (`#d4af37`, `rgba(255,255,255,0.06)`).
- **Motyw**: tylko ciemny. `:root` i `.dark` mają te same wartości, `<html class="dark">` na stałe, brak `next-themes` i `prefers-color-scheme`. `.theme-black-gold` to alias dla starych klas auth.
- **Typografia**: `--font-sans` Geist (tekst), `--font-heading` Space Grotesk (tytuły, 74 pliki), `--font-display` Bebas Neue (duże liczby, 18), `.font-metric` Playfair Display (liczby/indeksy, 50), Geist Mono. Brak skali tokenów - rozmiary arbitralne: `text-[11px]` (349 użyć), `[10px]` (234), `[13px]` (217), `[12px]` (212), `[9px]` (28) itd. Stałe klasy tekstu w `components/layout/screen.tsx` (`appPageKickerClass`, `appPageTitleClass` 28 px, `screenTitleClass` 2xl) oraz `.app-label` (10 px uppercase, white 38%) i `.app-value` (tabular, złoto). `tabular-nums` w 97 plikach.
- **Promienie**: `--radius 0.625rem` + skala `--radius-sm..4xl`, ale w praktyce: `.app-card` 22 px, `.app-card-raised`/`.app-panel` 16 px, `.glass-panel` 14 px, `.app-dialog` 22 px, Button `rounded-2xl`, Input `rounded-lg`, oraz arbitralne `rounded-[20|22|24|26|28|30px]` (21 plików).
- **Cienie i powierzchnie**: `--gym-tile-shadow` (wspólny cień kafla), klasy `.app-card*`, `.glass-panel` (blur 24 px), `.gold-panel`, `.iron-panel` (nieużywana), `.neon-glow`, `.street-glow`, `.metallic-text`, `.metal-surface`, `.grain-overlay`, tło `MetalBackdrop` z orbami ambient.
- **Przyciski w CSS**: `.gym-btn-primary` (gradient złota), `.gym-btn-outline`, `.gym-btn-secondary` oraz zduplikowany `.gold-btn` (ta sama definicja co primary).
- **Odstępy**: domyślna skala Tailwind (4 px); brak własnych tokenów. Ekran: `px-3 py-3 sm:px-5`, sekcje `space-y-5`.
- **Ruch**: keyframes w `globals.css` (`page-enter` 0.24 s, sheen kart, ambient, `iron-pulse`, `diary-*`) z wyłączeniem w `prefers-reduced-motion` dla części; framer-motion w 22 plikach bez `useReducedMotion`/`MotionConfig`.
- **Dotyk**: `.touch-target` (44 px), `.chip-scroll`, `.pb-thumb-bar`, `ThumbActionBar`.
- **PWA**: manifest dynamiczny `app/api/branding/manifest/route.ts` (ikona z brandingu, fallback `/next.svg`), `theme_color`/`background_color #07080d` (różne od `--gym-black #070708`). Statyczny `public/manifest.webmanifest` ma tylko `/next.svg` i opis po angielsku.

## 4. Biblioteka komponentów

### `components/ui/` (shadcn na `@base-ui/react`)
| Komponent | Stan | Użycie |
|---|---|---|
| `button.tsx` (`Button`, `buttonVariants`) | warianty `default`, `cta`, `outline`, `secondary`, `ghost`, `destructive`, `link`; rozmiary `xs` 36 px, `sm` 40, `default` 44, `lg` 48, `icon` 40, `icon-xs` 28, `icon-sm` 36, `icon-lg` 44 | 73 pliki |
| `input.tsx`, `textarea.tsx`, `label.tsx` | ciemne pola `bg-black/50`, 44 px | 37 / 9 / 17 |
| `sheet.tsx` | dolne/boczne arkusze | 13 |
| `alert-dialog.tsx`, `confirm-dialog.tsx` | modale i potwierdzenia | 15 / 5 |
| `inline-banner.tsx` | `info/success/warning/error` | 8 |
| `section-label.tsx` | nagłówek sekcji z indeksem i linią (złoty/biały) | 16 |
| `animated-metric.tsx` | animowana liczba | 16 |
| `file-picker-button.tsx`, `dropdown-menu.tsx`, `card.tsx` | | po 1 |
| `tabs.tsx`, `progress.tsx`, `avatar.tsx`, `separator.tsx` | **nieużywane** | 0 |

### Wzorce warstwy `layout/`
- `components/layout/screen.tsx`: `AppPageHeader` (nagłówek ekranu z kickerem, 11 plików), `AppStatTile`, `ScreenCard`, `ScreenHeading`, `ScreenHeader` (wycentrowane, 9 plików - auth/błędy), `ScreenLoading`, klasy `screen*Class`.
- `dashboard-route-skeleton.tsx`, `thumb-action-bar.tsx`, `start-workout-fab.tsx`, `app-menu-coming-soon.tsx`, `brand-mark.tsx`, `metal-backdrop.tsx`.
- `components/feedback/save-feedback.tsx`: `useSaveFeedback()` (`notifySaved`, `notifyError`) - 63 pliki.

### Klocki domenowe
- `components/progress/progress-ui.tsx`: `ProgressSection`, `Surface`, `Eyebrow`, `StatTile`, `SegmentedControl`, `CollapsibleCard`, `Explainer`, `EmptyNote`, `Meter`, `PctValue`, `ToneIcon` - najbardziej dojrzały zestaw, opisany w `docs/progress-screens.json`.
- `components/admin/admin-ui.tsx`: `AdminPageHeader`, `AdminCard`, `AdminStat`, `AdminPill` (tony neutral/ok/warn/danger/info/gold), `AdminNotice`, `AdminEmpty`, `AdminLoading`, `AdminField`, `AdminSelect`.
- `community/community-empty-state.tsx`, `meal-suggestions/meal-catalog-empty-state.tsx`, `home/empty-app-guide.tsx`.
- `components/auth/auth-card.tsx` (`AuthCard`, od 2026-10-24, zadanie 001): jedyny kontener karty ekranów auth - `glass-panel gold-panel`, `p-6 sm:p-8`, dwa dekoracyjne orby `--neon` (`aria-hidden`), prop `bodyClassName` na odstępy treści (np. `space-y-5`). Używany w `login-screen`, `register-form`, `account-takeover-screen`. Wyjątek od zalecenia "kontener = `app-card`": dotyczy wyłącznie grupy `(auth)` i dokończenia profilu. Nie kopiować klas `glass-panel gold-panel` inline - kopie do usunięcia: `app/(dashboard)/complete-profile/page.tsx:58`, `components/auth/complete-profile-session-bridge.tsx:35`, `components/auth/auth-session-hydrating.tsx:55,76`, `components/auth/register-form.tsx:483` (backlog U7).
- `components/auth/oauth-privacy-note.tsx` (`OAuthPrivacyNote`): informacja LR-25 pod przyciskami dostawców, `text-[13px] text-white/65`, link `var(--neon)`; tylko gdy dostawca OAuth jest włączony.
- `components/auth/auth-copy.ts`: jedno źródło mikrokopii logowania, rejestracji i przejęcia konta (`oauthErrorMessage`, `registerWelcomeCopy`, `TAKEOVER_ERROR_MESSAGES`).
- `components/admin/admin-registration-notice.tsx` (`AdminRegistrationNotice`): baner stanu rejestracji składany z `AdminNotice` (ton `danger` "nikt nie założy konta", `warn` "rejestracja e-mailem wyłączona"), ikona `UserX`/`MailX` obok tekstu.

### Zalecenia dla nowych widoków (do czasu konsolidacji)
Nagłówek: `AppPageHeader`; sekcja: `SectionLabel` lub `ProgressSection`; kontener: klasa `app-card` (nie `ui/card`, nie `glass-panel`); akcje: `Button` z wariantem (nie surowe `gym-btn-primary`/`gold-btn`); pola: `Input`/`Textarea`/`Label`; potwierdzenia: `ConfirmDialog`; komunikaty: `useSaveFeedback` + `InlineBanner`; ładowanie: szkielet na `app-card animate-pulse`; CTA w strefie kciuka: `ThumbActionBar`. Admin: wyłącznie `admin-ui.tsx`.

## 5. Wzorce stanów
- **Ładowanie**: szkielety `DashboardRouteSkeleton` (route `loading.tsx` + fallback `Suspense` na `/`, `/workout-plan`, `/meal-suggestions`, `/progress`), `home/home-header-skeleton`, `daily-briefing-skeleton`, `home-przemiana-skeleton` (16 plików z `animate-pulse`/Skeleton). Równolegle spinnery: `Loader2`/`animate-spin` (7/11 plików, m.in. `AdminLoading`) i `ScreenLoading` (logo + "Ładowanie…").
- **Puste**: 6 różnych implementacji (`CommunityEmptyState`, `MealCatalogEmptyState`, `EmptyAppGuide`, `EmptyNote`, `AdminEmpty`, `AppMenuComingSoon`) + inline (`app/(dashboard)/inbox/page.tsx`).
- **Błąd**: granice `error.tsx` z `ScreenCard` + `ScreenHeading` "Coś poszło nie tak" + kod referencyjny (`components/errors/use-boundary-report.ts`) + "Spróbuj ponownie"; `GlobalErrorHandlers`; w formularzach `InlineBanner variant="error"` lub `notifyError`.
- **Sukces / "toasty"**: brak biblioteki toastów. `SaveFeedbackProvider` pokazuje **modalny `AlertDialog`** (ikona `CheckCircle2`/`XCircle`, auto-zamknięcie 3,2 s, domyślnie "Zapisano zmiany."). Osobno `reports/workout-complete-popup.tsx` (własny "toast" przez `sessionStorage`) i `report-submit-popup.tsx`.
- **Potwierdzenia**: `ConfirmDialog`/`AlertDialog` vs natywne `window.confirm`/`confirm` w `community/notification-center.tsx:274`, `community/team-settings-form.tsx:132`, `home/meal-logs-list.tsx:42`, `meal-suggestions/diet-diary-sections.tsx:57`, `workout-plan/workout-plan-editor.tsx:328`.
- **Offline**: tylko kolejka treningów (`workout/workout-outbox-flush.tsx`, `reports/queued-workout-banner.tsx`); brak ogólnego wskaźnika offline.
- **Brak uprawnień**: admin - inline `glass-panel` w `app/admin/(panel)/layout.tsx` oraz `ScreenCard` w `app/admin/page.tsx` (dwa różne wyglądy tego samego stanu).

## 6. Mikrokopia
- Ton: bezpośredni, na "ty", krótki, siłowniany ("Zawodnik", "Wróć na start", "Spróbuj ponownie"). Podtytuły menu małą literą ("dni, serie, start sesji").
- `lang="pl"`, i18n (`lib/i18n/messages/pl.ts`, `en.ts`, `components/i18n/i18n-provider.tsx`) używane tylko w 9 plikach; reszta tekstów wpisana w JSX - przełącznik języka w profilu nie obejmuje większości UI.
- Niespójności: "Ładowanie…" vs "Wczytywanie…" (po ok. 8 wariantów każdego); anglicyzmy widoczne dla użytkownika: zakładka "Team", pozycja menu "Community", "Team Wars", "ligi Bronze→Diamond", "XP"; mieszanie "Grupy" / "Team" / "drużyny" dla tego samego pojęcia; manifest PWA z opisem po angielsku ("Premium fitness OS — ... AI-ready"), mimo że aplikacja nie ma wbudowanego AI.

## 7. Dostępność - obserwacje
- Plusy: globalny `:focus-visible` (2 px `--ring`) w `globals.css`; Button i Input mają własny ring; `aria-current="page"` i `aria-label="Nawigacja główna"` w belce; `aria-busy` w szkielecie; `userScalable: true`, `maximumScale: 5`; `prefers-reduced-motion` dla animacji CSS kart i ambient; pola 44 px; zakładki belki 52 px wysokości.
- Ryzyka kontrastu: `text-white/45` (316 użyć) i `/40` (321) dają ok. 4,4:1 i 3,7:1 na `#050505` - poniżej 4,5:1 dla małego tekstu; `/35` (152), `/30`, `/25` jeszcze niżej; `.app-label` (white 38%, 10 px) jest standardowym stylem etykiet. Nieaktywne zakładki belki `text-white/45` przy 9 px.
- Mały tekst: 9-11 px w setkach miejsc (etykiety, belka).
- Cele dotykowe: `Button size="icon-xs"` 28 px, `icon-sm`/`xs` 36 px - poniżej 48 px wymaganych dla trybu treningu; 106 plików z surowym `<button>` bez gwarancji rozmiaru i focusu.
- framer-motion (22 pliki) nie respektuje ograniczenia ruchu; `diary-nav-breathe` i `conic-spin` działają w pętli.
- Kolor jako jedyny nośnik: tony `emerald`/`rose`/`amber` (`InlineBanner`, `AdminPill`, `AppStatTile tone`) - ikony są opcjonalne.
- Natywne `confirm()` łamie styl i fokus modalny. `aria-live` tylko w 8 plikach.

## 8. Niespójności i duplikaty
| # | Problem | Ścieżki | Priorytet |
|---|---|---|---|
| 1 | Złoto poza tokenem: co najmniej 5 odcieni wpisanych na sztywno obok `--gym-gold #ebc44a` | `#d4af37` (40 użyć: `reports/*`, `home/weight-range-chart.tsx`, `progress-analysis/weigh-in-card.tsx`), `#D6B36A` (`active-workout/guided-session-layout.tsx`, `session-chrome.tsx`, `live-coach-banner.tsx`), `#DDBB6D` (`layout/app-shell.tsx`, `meal-suggestions/diet-*`, `legal/legal-doc-shell.tsx`, strony `(legal)`), `#e8c547`, `#F0D58A`, `#b8922a`; ciemne tła `#121212`, `#0E0E0E`, `#0A0A0A`, `#07070c` (68 plików z hex) | Wysoki |
| 2 | Kafel statystyki w 4 wersjach | `layout/screen.tsx` `AppStatTile`, `progress/progress-ui.tsx` `StatTile`, `reports/stat-card.tsx` `StatCard`, `admin/admin-ui.tsx` `AdminStat` | Wysoki |
| 3 | Dwa języki kart: `ui/card` (`glass-panel`, blur) vs `.app-card` (płaski) + `Surface`, `AdminCard`; `ui/card` użyty tylko w `active-workout/active-workout-view.tsx`, `glass-panel` w 24 plikach | `components/ui/card.tsx`, `app/globals.css`, `progress/progress-ui.tsx` | Wysoki |
| 4 | Przyciski: CSS `.gold-btn` duplikuje `.gym-btn-primary`; 22 pliki z ręcznym `gym-btn-primary`, 12 z `gold-btn`, 106 z surowym `<button>` | `app/globals.css`, np. `layout/screen.tsx` `screenCtaClass`, `app-shell.tsx` `ReportFab` | Wysoki |
| 5 | Potwierdzenia natywnym `confirm()` zamiast `ConfirmDialog` | 5 plików wymienionych w sekcji 5 | Wysoki |
| 6 | Feedback zapisu jako modal blokujący (AlertDialog) zamiast nieblokującego toastu; osobne popupy | `feedback/save-feedback.tsx`, `reports/workout-complete-popup.tsx`, `reports/report-submit-popup.tsx` | Średni |
| 7 | 6 implementacji pustego stanu + inline | sekcja 5 | Średni |
| 8 | Zakładki/segmenty w 5 wersjach, `ui/tabs` nieużywane | `progress/progress-tabs.tsx`, `progress-ui.tsx` `SegmentedControl`, `community/community-hub-tabs.tsx`, `community/team-subnav.tsx`, `community/hof/hof-period-tabs.tsx`, `ui/tabs.tsx` | Średni |
| 9 | Nagłówki ekranów: `AppPageHeader` vs `ScreenHeader`/`ScreenHeading` vs `AdminPageHeader` vs inline (`(dashboard)/inbox/page.tsx` `text-3xl`, kicker `white/40` zamiast złotego) | `layout/screen.tsx`, `admin/admin-ui.tsx` | Średni |
| 10 | Brak skali typografii i promieni (setki `text-[Npx]`, `rounded-[Npx]`); `--radius-*` praktycznie pominięte | całe `components/` | Średni |
| 11 | Martwe komponenty (0 importów): `home/add-meal-sheet.tsx`, `workout/WorkoutSummary.tsx`, `workout/ExerciseCard.tsx`, `workout/RestTimerBar.tsx`, `workout-plan/workout-card.tsx`, `active-workout/workout-plan-card.tsx`, `active-workout/workout-glass-card.tsx`, `ui/tabs.tsx`, `ui/progress.tsx`, `ui/avatar.tsx`, `ui/separator.tsx`; nieużywana klasa `.iron-panel`, tokeny `--chart-*` | jak w kolumnie | Średni (do potwierdzenia przez `architekt`) |
| 12 | Pary o zbliżonej roli: `meal-suggestions/food-portion-screen.tsx` vs `food-portion-sheet.tsx`; `auth/auth-shell.tsx` vs `auth/auth-page-frame.tsx`; `home/weight-range-chart.tsx` vs `progress/weight-average-chart.tsx`; `home/meal-logs-list.tsx` vs `meal-suggestions/diet-diary-sections.tsx`; `nutrition/*` vs hub `meal-suggestions` | jak w kolumnie | Średni |
| 13 | Rozproszenie katalogów domeny treningu: `workout/` (PascalCase: `SetRow.tsx`, `RestTimerBar.tsx`), `workout-plan/`, `treningi/`, `active-workout/`, `workout-history/` | `components/` | Niski |
| 14 | Ładowanie: szkielety vs spinnery vs `ScreenLoading`; brak `loading.tsx` w admin i podtrasach | sekcja 5 | Niski |
| 15 | Kolor PWA `#07080d` / root `themeColor` vs `--gym-black #070708`; statyczny manifest z `/next.svg` | `app/layout.tsx`, `app/api/branding/manifest/route.ts`, `public/manifest.webmanifest` | Niski |
| 16 | Brak trybu jasnego mimo martwego bloku `.dark` | `app/globals.css`, `app/layout.tsx` | Niski (decyzja produktowa) |

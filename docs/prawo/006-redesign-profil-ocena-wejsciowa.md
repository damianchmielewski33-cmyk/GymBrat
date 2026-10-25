# 006 - Redesign ekranu Profil: bramka wejściowa (prawnik, etap 2)

- **Zadanie**: `docs/zadania/007-redesign-profil.md`
- **Podstawa**: `docs/analiza/007-redesign-profil.md` (analityk, etap 1; sekcje 3 T-10, 6.2 F-15..F-18, 6.3 US-5/US-8, 6.4 BR-9, 7 P-4, 8 bramki), `docs/prawo/00-inwentaryzacja-danych.md`, `docs/prawo/01-podstawy-prawne-i-retencja.md`, `docs/prawo/005-koniec-treningu-przeplyw-wejscie.md` (format i LR przykładowe).
- **Data**: 2026-10-25
- **Autor**: asystent AI (rola `prawnik`, ocena zawężona)
- **Status**: **projekt roboczy asystenta AI. Nie jest poradą prawną.** Tekst nie może trafić do użytkowników ani do dokumentów publikowanych bez zatwierdzenia przez prawnika-człowieka.
- **Numer dokumentu**: zadanie wskazywało `004`, ale `docs/prawo/004-*` już istnieje (ekran aktywnego treningu). Zastosowano regułę „kolejny numer po najwyższym” (najwyższy był 005), stąd `006`.

## 0. Zastrzeżenie o weryfikacji stanu prawnego

Przepisy przywołane poniżej (RODO art. 5 ust. 1 lit. c-e, art. 7, art. 9 ust. 2 lit. a, art. 15, art. 17, art. 20, art. 25, art. 32; przepis o przechowywaniu informacji w urządzeniu końcowym w Prawie komunikacji elektronicznej) pochodzą z wiedzy asystenta.

- **Próba weryfikacji 2026-10-25**: EUR-Lex (rozporządzenie 2016/679) zwrócił pustą treść, a ISAP (Dz.U. 2024 poz. 1907) strona weryfikacji (CAPTCHA). **Nie zweryfikowano w ISAP, EUR-Lex, UODO ani EROD.** Wymaga wykonania przez prawnika-człowieka przed Promote.
- **Rozbieżność do sprawdzenia**: analiza 007 (sekcja 3, T-10 i 8) i dokumenty 00/01 podają art. 399 PKE dla zgody na pliki i podobne technologie. Asystent podaje z pamięci art. 400 PKE (dawny art. 173 Prawa telekomunikacyjnego). Numer i brzmienie trzeba sprawdzić na eli.gov.pl. Wniosek z tej oceny nie zależy od numeru.

## 1. Werdykt

**ZATWIERDZONE Z UWAGAMI.**

Redesign jako zmiana układu, grupowania, nawigacji i wyglądu **nie wymaga pełnego przeglądu prawnego**. Wystarcza ta zawężona ocena, pod warunkiem spełnienia reguł LR-1 do LR-12 (sekcja 3) przez `architekt` i `ux`.

Zastrzeżenia, bez których redesign nie może trafić na produkcję (Promote):
1. Przełącznik zgód nie może obiecywać więcej, niż system realnie robi (LR-1, LR-4). Dziś wybór nie zapisuje się na serwerze i nie blokuje analityki po stronie serwera.
2. Teksty o eksporcie i usunięciu konta muszą opisywać faktyczny zakres, a nie zakres docelowy (LR-6, LR-7).
3. Wartości domyślne w formularzu ciała nie mogą być zapisywane jako dane użytkownika (LR-8).
4. Zastrzeżenie „nie jest poradą medyczną ani dietetyczną” przy celach kalorycznych i cardio jest stałe (LR-9).

## 2. Odpowiedź na P-4: czy model zgód w localStorage wystarcza

### 2.1 Stan faktyczny (zweryfikowany w kodzie)

- Zgody analityki i marketingu są w `localStorage` pod kluczem `gymbrat_consent_v1` (`lib/consent-preferences.ts:3, 60-81`). Zapis zawiera wersję schematu, `decidedAt`, `analytics`, `marketing`. **Nie zawiera wersji treści zgody.**
- Karta zgód: `components/consent/consent-settings-card.tsx` (uwaga: analiza 007 podaje ścieżkę `components/profile/consent-settings-card.tsx`; taki plik nie istnieje, numery linii 21 i 36 zgadzają się z plikiem w `components/consent/`). Karta importuje `ProfileSwitch` z `components/profile/profile-ui`.
- Zmiana zgody jest przekazywana do mostu Androida (`setMarketingConsent`, `consent-preferences.ts:113-123`). Ten kanał trzeba zachować.
- Brak tabeli zgód w `db/schema.ts` (zweryfikowane wyszukiwaniem: `user_consents` nie występuje w kodzie). Dokumenty 00 (R2, Braki 1) i 01 (LR-2, backlog pozycja 3) już to wskazują jako lukę P1.
- Analityka po stronie serwera (PostHog, `lib/analytics/track.ts`) jest wysyłana **bez sprawdzenia zgody** (00, R10). Zgoda w localStorage bramkuje tylko klienta (`canUseAnalytics`, `page_views`).
- Marketing: integracja AdMob nie jest skonfigurowana (decyzja właściciela D24). Przełącznik „Marketing i reklamy” nie ma dziś skutku poza mostem Androida.

### 2.2 Ocena

**Model localStorage nie jest wystarczający jako docelowy model zgód.** Powody:

| Ryzyko | Ocena | Dlaczego |
|---|---|---|
| Brak dowodu zgody (art. 7 ust. 1 RODO: administrator musi wykazać, że osoba wyraziła zgodę) | wysokie | Wpis w przeglądarce nie jest po stronie administratora. Nie da się wykazać kto, kiedy i na jaką wersję tekstu wyraził zgodę. Usunięcie danych przeglądarki kasuje „dowód”. |
| Niespójność między urządzeniami | wysokie | Wycofanie zgody na telefonie nie działa na komputerze. Analiza US-5 wymaga spójności; localStorage tego nie zapewni. |
| Brak wersjonowania treści zgody | średnie-wysokie | Po zmianie tekstu nie wiadomo, na który tekst zgodzono się. Dotyczy to też przyszłych zgód art. 9. |
| Skutek zgody nie jest egzekwowany po stronie serwera | wysokie | Przełącznik „Analityka” wyłączony, a PostHog po stronie serwera nadal dostaje zdarzenia z `userId`. Wyświetlanie przełącznika jako wyłączenia analityki jest wprowadzaniem w błąd (art. 5 ust. 1 lit. a, przejrzystość; art. 7 ust. 3). |

Zgoda na przetwarzanie danych o zdrowiu i ciele (art. 9 ust. 2 lit. a) jeszcze nie istnieje w aplikacji (00, Braki 2). Redesign nie może jej pozornie wprowadzić przez przełącznik bez zapisu serwerowego.

### 2.3 Zalecenie

**Zapis zgód na serwerze jest warunkiem wdrożenia (Promote) redesignu w części „Konto i prywatność” oraz każdej części, która mówi o zgodach, spójności lub skutku wyłączenia.** Nie jest natomiast warunkiem etapów 3 i 4 (architektura i makieta) ani samej przebudowy układu. Na etapach 3-4 można projektować na obecnym mechanizmie, pod warunkiem że architekt zaprojektuje docelowy zapis serwerowy jako osobną pozycję (tabela `user_consents` lub równoważna, zgodnie z backlogiem pozycja 3), a `ux` nie przedstawi konsekwencji zgody inaczej niż w LR-4.

Warunki zapisu serwerowego (wymóg techniczny dla `backend`, zgodnie z zasadą 3 z prawniczej roli):
- Każda zgoda: `userId`, typ (`analytics`, `marketing`, później `health`, `photos`), status, wersja tekstu, `decidedAt`, źródło (np. baner, profil, mostek Androida).
- Dobrowolność i rozdzielność: przełącznik osobno dla każdej kategorii, bez przedwyboru.
- Wycofanie równie łatwe jak udzielenie: jedno kliknięcie w profilu, skutek natychmiastowy.
- Skutek po stronie serwera: wysyłka do PostHog i zapis `page_views` tylko po sprawdzeniu zgody zapisanej na serwerze (LR-6 z 01).
- localStorage może pozostać wyłącznie jako pamięć podręczna do pierwszego renderu. Nie jest dowodem.
- Rejestr zgód i żądań z retencją 3 lata po zakończeniu przetwarzania (01, pozycja 22) - okres do potwierdzenia przez prawnika.

**Dopuszczalny wariant awaryjny** (tylko gdy właściciel decyduje się wdrożyć redesign przed tabelą zgód):
- Opis przełącznika mówi, że wybór dotyczy tej przeglądarki („zapisany na tym urządzeniu”), bez obietnicy spójności między urządzeniami.
- Analityka po stronie serwera jest bramkowana albo tekst nie twierdzi, że wyłączenie zatrzymuje wszystkie zdarzenia. Obie opcje muszą być uzgodnione w ADR.
- Redesign nie dodaje żadnej nowej zgody.
- Zmiana wraca do prawnika jako pełny przegląd przed Promote.

## 3. Reguły LR dla `architekt` i `ux` (numeracja zadania 007)

- **LR-1 (zapis zgód)**. Patrz 2.3. Przełącznik zgód w nowym układzie zapisuje się na serwerze (warunek Promote). Wszystkie przełączniki działają od razu i nie zależą od sekcji. Architekt wybiera model w ADR. Wymagana wersja tekstu i źródło wyboru.

- **LR-2 (rozdział zgód od danych niezbędnych)**. Zgody opcjonalne (Analityka, Marketing i reklamy) to przełączniki. Dane niezbędne (sesja, CSRF, bezpieczeństwo) są tylko informacją tekstową. Nie mogą mieć przełącznika ani wyglądać jak wybór. Każda przyszła zgoda art. 9 (zdrowie i ciało, zdjęcia sylwetki) ma osobny przełącznik, nieprzedwybrany. Dodanie takiej zgody jest już zmianą wymagającą pełnego przeglądu.

- **LR-3 (równy wybór i łatwe wycofanie)**. „Akceptuj wszystkie” i „Tylko niezbędne” mają tę samą widoczność i rozmiar. Obecnie „Akceptuj wszystkie” ma styl `gym-btn-secondary`, a „Tylko niezbędne” `gym-btn-outline`. Uprzywilejowanie jednej opcji wymaga przeglądu prawnego i zwykle jest uznawane za wzorzec utrudniający odmowę. Wycofanie zgody wymaga tyle samo kroków co jej udzielenie (art. 7 ust. 3 RODO).

- **LR-4 (prawdziwość opisów zgód)**. Opis każdego przełącznika musi odpowiadać realnemu skutkowi:
  - „Analityka”: opis „Statystyki wejść i użycia aplikacji” jest prawdziwy tylko dla klienta. Jeśli serwer nadal wysyła zdarzenia, tekst nie może mówić, że wyłączenie zatrzymuje analitykę. Do czasu bramki po stronie serwera tekst ogranicza się do tego, co faktycznie się wyłącza.
  - „Marketing i reklamy”: dopóki AdMob (D24) nie jest skonfigurowany, nie pokazywać tego przełącznika jako aktywnego. Pokazać stan „Nieaktywne w tej wersji” albo ukryć. Zgody bez celu nie zbiera się (art. 5 ust. 1 lit. c, minimalizacja).
  - Znacznik „Ostatnia decyzja: data” jest prawdziwy tylko, gdy zapis istnieje (lokalnie lub na serwerze).

- **LR-5 (link do polityki prywatności)**. Link „Polityka prywatności” jest widoczny w sekcji „Konto i prywatność” bez konieczności przewijania poza ten blok (F-18). Kotwica `#cookies` (`PRIVACY_PATH`) musi istnieć w dokumencie. Według 00 (pozycja 10) polityka cookies nie jest osobnym dokumentem, więc przed wdrożeniem sprawdzić kotwicę albo linkować bez niej. Link do regulaminu w tym bloku jest dobrowolny.

- **LR-6 (eksport: zakres opisany prawdziwie)**. Eksport JSON/CSV (F-16) jest niepełny (00, Braki 8). Do czasu zamknięcia zadania eksportu:
  - nie używać sformułowań „wszystkie dane”, „pełny eksport”, „kompletna kopia”;
  - mikrokopia: „Pobierz dane z aplikacji (JSON lub CSV). Zakres eksportu: [lista do potwierdzenia po zadaniu eksportu]”;
  - przed pobraniem ostrzeżenie: „Plik zawiera dane o treningach, zdrowiu i ciele. Przechowuj go bezpiecznie” (zatwierdza człowiek);
  - eksport nie jest wysyłany e-mailem ani przechowywany na serwerze w tym zadaniu.

- **LR-7 (usuwanie konta: nieodwracalność i skutki)**. Dialog przed potwierdzeniem musi:
  - napisać wprost, że operacji nie da się cofnąć (obecnie tak jest: „Tej operacji nie da się cofnąć”) i wymienić kategorie, które znikają (treningi, posiłki, wagi, raporty ciała, zdjęcia, posty i komentarze, znajomości, ustawienia);
  - nie obiecywać, że wszystko znika natychmiast u dostawców (PostHog, Sentry, kopie zapasowe, bramka płatności): to jest do potwierdzenia (00, R8 i Braki 7). Zamiast tego: „Dane mogą pozostać w kopiach zapasowych i u dostawców technicznych do czasu ich wygaśnięcia [do potwierdzenia]”;
  - nie mówić, że zamówienia są zachowane, dopóki kaskada nie zostanie zmieniona (00, R8: obecnie `CASCADE`). Zamiast tego opis dostosowany do decyzji prawnika;
  - zachować frazę „USUŃ” (przycisk nieaktywny do jej wpisania, US-8) i wizualnie oddzielić strefę usuwania od eksportu;
  - rekomendacja (backlog, pozycja 5, nie warunek redesignu): ponowne potwierdzenie hasłem dla kont z hasłem.

- **LR-8 (dokładność danych wejściowych)**. Pola ciała (waga, wzrost, wiek, płeć) nie mogą mieć wartości domyślnych zapisywanych jako dane użytkownika (80/180/25, `body-params-form.tsx:75-97`). Dane wprowadzone przez system są błędnymi danymi osobowymi (art. 5 ust. 1 lit. d, prawidłowość) i wpływają na kalorie. Zapis: tylko wypełnione pola albo walidacja z komunikatem. Źródło wagi wyświetlanej na Profilu (P-1) ma być podpisane datą i źródłem (np. „z wpisu z 12.10”).

- **LR-9 (zastrzeżenie przy wyliczeniach zdrowotnych)**. Przy celach kalorycznych, makro, sumach dnia i celu cardio ma być stałe, widoczne zastrzeżenie, np.: „Wartości są orientacyjne. To nie jest porada medyczna ani dietetyczna.” (LR-12 z 00). Ostrzeżenie o sumie posiłków względem celu (P-2) jest informacją o różnicy, nie zaleceniem. Usunąć żargon („Keytel”, „VAPID”) z tekstów dla użytkownika (NFR-9).

- **LR-10 (osoby poniżej 18 lat)**. Minimalny wiek to 16 lat (D18). Przy wieku poniżej 18 lat w profilu cele deficytu kalorycznego wyświetlają się z dodatkowym ostrzeżeniem o zaburzeniach odżywiania i odesłaniem do lekarza (01, pkt 4.x, „zabezpieczenia dla 16-17”). Dla wieku 16-17 zabezpieczenia są rekomendacją, nie wymogiem wprost z RODO, ale ich brak jest istotnym ryzykiem oceny DPIA. Architekt przewiduje tę ścieżkę w projekcie.

- **LR-11 (logi, Sentry, analityka)**. Redesign nie dodaje zdarzeń analitycznych ani logów z wagą, wzrostem, wiekiem, płcią, kcal, makro ani stanem zgód (NFR-5, LR-5 z 00). Nie wysyłać wartości pól w breadcrumbs Sentry. Zalecenie dla `backend`/`frontend`: test lub reguła, która sprawdza brak `console.` w komponentach profilu z wartościami formularza.

- **LR-12 (teksty prawne i mikrokopia)**. Każdy nowy tekst zgody, eksportu, usunięcia, zastrzeżenia i link do polityki jest zatwierdzany przez człowieka przed Promote (LR-13 z 01). Zmiana tekstu zgody lub zakresu eksportu/usunięcia zapisywana w `docs/prawo/` z wersją i datą. Ogólne etykiety (np. „Zapisz”, „Cel cardio”) zatwierdza `ux`.

## 4. Wymagane dokumenty i zgody

| Element | Decyzja | Wymóg przed Promote |
|---|---|---|
| Model zgód (P-4) | Zapis serwerowy zgód (LR-1), zgodnie z backlogiem pozycja 3 | Działający zapis i wycofanie; ADR `architekt`; przegląd prawnika (pełny) przy wdrożeniu |
| Teksty przełączników (Analityka, Marketing) | Zmienić zgodnie z LR-4 | Zatwierdzenie tekstu przez człowieka |
| Polityka prywatności (link z profilu) | Bez zmiany celu; treść niepełna (00, Braki 3) | Aktualizacja zgodna z backlogiem pozycja 2-3, przed Promote redesignu wskazać link do istniejącej wersji |
| Teksty eksportu i usunięcia (LR-6, LR-7) | Zakres prawdziwy na dzień wdrożenia | Zatwierdzenie tekstu przez człowieka; po zadaniu eksportu i usuwania zaktualizować |
| Dokumenty 00 i 01 | Bez zmian przez redesign; po wdrożeniu zgód serwerowych wymagają aktualizacji | Zatwierdzenie przez prawnika-człowieka |
| Nowa zgoda art. 9 (zdrowie, zdjęcia) | Poza zakresem redesignu. Redesign jej nie wprowadza | Osobne zadanie i pełny przegląd |

## 5. Odpowiedź na pytanie: czy redesign wymaga pełnego przeglądu

- **Zmiana układu, grupowania, nawigacji, wyglądu, kolejności sekcji** (F-1 do F-20 bez zmiany znaczenia): zawężona ocena wystarcza. Ten dokument jest jej wynikiem.
- **Pełny przegląd prawnika (przed Promote)** jest potrzebny, gdy zmieni się którykolwiek z elementów:
  - sposób przechowywania zgód (zapis serwerowy, nowe tabele);
  - treść zgody lub opisu jej skutku poza etykietami;
  - zakres eksportu lub usunięcia konta (w tym decyzja o zamówieniach);
  - nowa kategoria zgody (art. 9) lub nowy odbiorca danych;
  - sposób pokazywania wartości zdrowotnych, który zmienia ich znaczenie.

## 6. Ryzyka

| ID | Ryzyko | Prawdopodobieństwo | Skutek | Środek (właściciel) |
|---|---|---|---|---|
| R-1 | Redesign obiecuje spójność zgód między urządzeniami, której nie ma | Wysokie bez zmian | Wysoki (art. 7, wprowadzenie w błąd) | LR-1, LR-4 (architekt, ux) |
| R-2 | Przełącznik „Analityka” wyłączony, a serwer dalej wysyła zdarzenia | Pewne (stan obecny) | Wysoki | LR-1 i bramka po stronie serwera (backend, backlog 7) |
| R-3 | Marketing zbierany bez celu (AdMob nieskonfigurowany) | Średnie | Średni (minimalizacja) | LR-4 (ux, właściciel) |
| R-4 | Eksport opisany jako pełny, a jest niepełny | Wysokie bez zmian tekstu | Wysoki (art. 15, 20) | LR-6 (ux, backend) |
| R-5 | Dialog usunięcia obiecuje zbyt wiele lub zbyt mało | Średnie | Średni-wysoki | LR-7 (ux, prawnik) |
| R-6 | Wartości domyślne 80/180/25 zapisane jako dane użytkownika | Wysokie bez zmian | Średni (art. 5 ust. 1 lit. d; błędne kcal) | LR-8 (backend, frontend) |
| R-7 | Zastrzeżenia zdrowotne znikają przy przebudowie widoku | Średnie | Średni | LR-9 (ux) |
| R-8 | Redesign odebrany jako zamknięcie braku zgód art. 9 (00, Braki 1-2) | Średnie | Wysoki | Opis w karcie i changelogu: redesign nie zamyka braku zgód |

## 7. Pytania otwarte do właściciela

1. **P-4 (decyzja właściciela)**: czy redesign ma czekać na zapis zgód serwerowy (zalecenie: tak, przed Promote), czy wdrażamy wariant awaryjny z 2.3 i akceptujemy ryzyko R-1 i R-2 na czas przejściowy?
2. **Marketing**: czy przełącznik marketingowy ma pozostać, skoro AdMob jeszcze nie działa (D24)?
3. **Analityka po stronie serwera**: czy właściciel zleca bramkę zgody dla PostHog (backlog 7) przed redesignem, czy po nim?
4. **Usunięcie konta**: jaki jest docelowy skutek dla zamówień (zachowanie zamiast kaskady, anonimizacja, czy pozostawienie zgodnie z obowiązkiem księgowym)? Od tego zależy tekst z LR-7.
5. **Eksport**: czy zadanie domknięcia eksportu (00, Braki 8) jest planowane przed redesignem? Jeśli nie, tekst z LR-6 obowiązuje w wersji ograniczonej.

## 8. Co wymaga zatwierdzenia przez prawnika-człowieka

- Ocena P-4 i zalecenie co do warunków Promote.
- Wszystkie teksty dla użytkowników z sekcji 3 (LR-4, LR-6, LR-7, LR-9) i tekst zastrzeżenia zdrowotnego.
- Zakres kategorii usuwanych i przechowywanych przy usuwaniu konta (LR-7) oraz obowiązek księgowy dla zamówień.
- Numer i brzmienie przepisu o zgodzie na pliki i podobne technologie (art. 399 w analizie, art. 400 wg asystenta; do sprawdzenia w ISAP/eli.gov.pl).
- Weryfikacja przepisów RODO w EUR-Lex i wytycznych UODO/EROD (nie wykonano, zob. sekcja 0).

## 9. Zastrzeżenie

Projekt roboczy asystenta AI. Nie jest poradą prawną i nie zastępuje decyzji prawnika-człowieka ani właściciela produktu. Ocena dotyczy zadania 007 na podstawie analizy etapu 1 i kodu odczytanego na gałęzi `feat/koniec-treningu-flow` w dniu 2026-10-25. Nie zweryfikowano aktualnego stanu prawnego w oficjalnych źródłach (zob. sekcja 0).

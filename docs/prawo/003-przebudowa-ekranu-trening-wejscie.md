# 003 - Przebudowa ekranu Trening: bramka wejściowa (prawnik)

Projekt roboczy asystenta AI, nie porada prawna. Przed publikacją zmian w tekstach dla użytkowników zatwierdza je prawnik-człowiek. Data oceny: 2026-10-23. Ocena oparta na wymaganiach `docs/analiza/003-przebudowa-ekranu-trening.md` i istniejących dokumentach `docs/prawo/00-inwentaryzacja-danych.md`, `01-podstawy-prawne-i-retencja.md`. Nie weryfikowano na nowo ISAP/EUR-Lex/EROD; zmiana nie wprowadza nowych operacji przetwarzania, więc stan prawny z poprzednich dokumentów pozostaje punktem odniesienia.

## Werdykt
ZATWIERDZONE Z UWAGAMI (brak nowej zgody, brak DPIA dla tej zmiany; uwagi to reguły LR-1..LR-8 sprawdzane na bramce wyjściowej).

## Ocena
1. Charakter operacji: zmiana prezentacji. Te same dane (ćwiczenia, ciężary, powtórzenia, daty sesji, minuty cardio) wyświetlane są wyłącznie zalogowanemu właścicielowi na jego ekranie. Grupy mięśni są wyliczane w locie z nazw ćwiczeń i nie są zapisywane. Brak nowego celu, nowych kategorii danych, nowych odbiorców, nowych pól i profilowania. Wyświetlenie własnych danych osobie, której dotyczą, nie jest nową operacją wymagającą osobnej podstawy; obowiązuje dotychczasowa podstawa (art. 6 ust. 1 lit. b RODO, wykonanie umowy o świadczenie dziennika treningowego).
2. Art. 9 RODO: ciężary, powtórzenia i częstotliwość treningów to dane o aktywności fizycznej. Same w sobie nie ujawniają stanu zdrowia, ale w skrajnym zestawieniu (np. zmiany obciążeń) mogą pośrednio go sugerować, więc traktujemy je ostrożnie jak dane wrażliwe zgodnie z `docs/zespol/przeplyw.md`. Ponieważ nie ma nowego przetwarzania, nie wymaga to nowej zgody ani zmiany polityki prywatności. Otwarta pozostaje wcześniej zidentyfikowana luka (brak wyraźnej zgody art. 9 na dane o ciele); zadanie 003 jej nie pogłębia ani nie zamyka.
3. Skutki automatyczne (art. 22): brak. Wskazanie „Następny" wynika z prostej kolejki i jest tylko podpowiedzią UI, bez skutków prawnych. Nie jest to wyrób medyczny ani porada.
4. DPIA: nie jest potrzebna dla tej zmiany.
5. Polityka prywatności: bez zmian, o ile spełnione LR-1..LR-3. Jeśli w trakcie prac pojawi się nowy odbiorca, nowe logowanie wartości lub przechowywanie wyliczonych partii, zadanie wraca do bramki wejściowej.

## Reguły LR (dla architekt, ux, backend, frontend)
- LR-1 Brak ciężarów, powtórzeń, nazw ćwiczeń, nazw planów i grup mięśni w logach serwera, Sentry (wiadomości, breadcrumbs, extra, tagi) i analityce (PostHog). Błędy parsowania JSON sesji raportować bez treści danych (tylko kod błędu, id techniczne bez danych treningowych).
- LR-2 Zapytania i DTO filtrowane po `user_id` z sesji, nigdy po identyfikatorze przekazanym przez klienta bez weryfikacji właściciela. Brak nowych publicznych endpointów. Brak współdzielonego cache (CDN, `use cache`, ISR) dla danych ekranu; odpowiedzi per użytkownik, bez publicznego cache.
- LR-3 Brak nowych kolumn, tabel, localStorage/IndexedDB z ciężarami poza istniejącym stanem niedokończonego treningu. Wyliczone partie mięśni nie są zapisywane. Brak zmian w `app/api/android/*` i Javie. Start grupowy nie przekazuje ciężarów ani historii innym uczestnikom.
- LR-4 Brak nowych zgód i bannerów. Istniejąca retencja (`lib/db-retention.ts`) obejmuje dane źródłowe; ekran nie tworzy kopii, więc usunięcie konta/danych usuwa także podstawę wyświetlania.
- LR-5 Dostępność (EAA, dyrektywa 2019/882, ustawa o dostępności produktów i usług; kryteria WCAG 2.1 AA, 1.1.1, 1.4.1, 1.4.3, 2.5.5 jako cel praktyczny): każda ikona sylwetki i segment tygodnia ma tekstowy odpowiednik (np. „Dzień 2: klatka, barki, triceps, wykonany w tym tygodniu"); stan nie tylko kolorem; kontrast min. 4,5:1; cele dotyku min. 44 px; menu ⋮ obsługiwalne klawiaturą i Esc; `prefers-reduced-motion` respektowane. Deklaracja dostępności aplikacji (jeśli istnieje lub jest planowana) nie może być pogorszona.
- LR-6 Mikrokopia: neutralne, opisowe teksty („Następny", „ostatnio 12.10", „80 kg × 8", „Siłownia 2 / 4"). Zakaz sugestii medycznych, diagnostycznych i dietetycznych, oceniania ciała, wywoływania poczucia winy (np. „stracisz serię", „nadrób zaległości", „za mało"), gwarancji efektów oraz porównań normatywnych. Chip serii informacyjny, bez presji; ukrywany przy 0. Zakaz formułowania ciężarów jako zaleceń („zwiększ do 85 kg") - pokazujemy wyłącznie historię użytkownika, nie rekomendację. Podpisy partii mięśni jako opis planu, nie ocena.
- LR-7 Ikony sylwetki: własne lub o jasnej licencji, bez zdjęć osób; wizerunek i prawa autorskie - assety w repo muszą mieć znane źródło i licencję zgodną z modelem projektu (wpis o źródle w PR). Nowe zależności npm dla ikon tylko po sprawdzeniu licencji.
- LR-8 „Porzuć" niedokończony trening: wymagane potwierdzenie z jasnym tekstem o skutku (usunięcie niezapisanych danych sesji) - spełnia zasadę kontroli użytkownika nad własnymi danymi i ogranicza przypadkową utratę.

## Ryzyka
| Ryzyko | Prawdop. | Skutek | Środek |
|---|---|---|---|
| Wartości treningowe w Sentry przy błędzie parsowania | średnie | średni (dane wrażliwe poza zakresem celu) | LR-1, test na brak treści w raporcie |
| Cache współdzielony ujawni dane innemu użytkownikowi | niskie | wysoki | LR-2, przegląd `tester-bezpieczenstwa` |
| Mikrokopia odbierana jako rada/ocena (zwł. u młodych osób, ryzyko zaburzeń) | niskie | średni | LR-6 |
| Ikony bez odpowiedników tekstowych | średnie | średni (EAA) | LR-5 |
| Licencja assetów ikon | niskie | niski | LR-7 |

## Pytania otwarte
- Czy istnieje opublikowana deklaracja dostępności i kto jest administratorem (dane podmiotu w dokumentach prawnych nadal do uzupełnienia)?
- Czy PostHog zbiera zdarzenia ekranu Trening (właściwości zdarzeń nie mogą zawierać danych treningowych)? Do sprawdzenia przez `backend`.

## Do zatwierdzenia przez prawnika-człowieka
Potwierdzenie, że ciężary/historia treningowa wyświetlana właścicielowi nie wymaga osobnej zgody art. 9 oraz że luka zgody art. 9 dla danych o ciele jest rozwiązywana odrębnie.

## Bramka wyjściowa
Sprawdzić LR-1..LR-8 na kodzie (logi/Sentry, zapytania, cache, aria-labels, mikrokopia, potwierdzenie „Porzuć", licencje ikon) oraz brak zmian schematu i API Android.

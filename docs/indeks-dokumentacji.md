# Indeks dokumentacji GymBrat

Stan na 2026-11-04 (US20/Z83). Obowiązujący plan prac: **[audyt/backlog-us.md](audyt/backlog-us.md)** (szczegóły podzadań: [audyt/szczegoly-zadan.md](audyt/szczegoly-zadan.md), decyzje właściciela: [zespol/decyzje-wlasciciela.md](zespol/decyzje-wlasciciela.md)). Baza wiedzy zespołu: [zespol/wiedza-o-projekcie.md](zespol/wiedza-o-projekcie.md).

## Co jest czym

| Katalog / plik | Zawartość | Status |
|---|---|---|
| `audyt/` | Audyt przedkomercyjny (2026-11-01), backlog US1–US20, szczegóły podzadań | **obowiązuje** |
| `zespol/` | Baza wiedzy, decyzje właściciela (D, DK), przepływ pracy | obowiązuje; `backlog.md` — tylko historia |
| `analityka/kpi.md` | Zdarzenia KPI, definicje metryk, lejek do odtworzenia w PostHog (Z53) | obowiązuje |
| `ux/`, `prawo/`, `bezpieczenstwo/`, `wydajnosc/`, `testy/`, `adr/`, `analiza/` | Dokumenty dziedzinowe (stan + decyzje) | obowiązują; stan bazowy z 2026-10-23, nowsze zmiany w backlogu US |
| `bledy-do-naprawy/bledy.md` | Błędy niskiego priorytetu, decyduje właściciel | obowiązuje (pozycje „ZROBIONE” zostają jako ślad) |
| `docs/*.json` | Specyfikacje silników analitycznych — patrz niżej | wg tabeli |

## Status specyfikacji `docs/*.json` (D13)

Wynik przeglądu z `analiza/01-aktualnosc-specyfikacji.md`. Pliki JSON nie mają pola statusu (celowo — to dane), więc status jest tu.

| Plik | Status | Uwaga |
|---|---|---|
| `analytics-intelligence.json` | aktualny | źródło prawdy |
| `food-search-database.json` | aktualny | źródło prawdy |
| `live-set-coach-tips.json` | aktualny | źródło prawdy |
| `progress-screens.json` | aktualny | źródło prawdy dla układu ekranów Analizy |
| `workout-plan-creation.json` | aktualny | źródło prawdy |
| `extra-cardio-from-macros.json` | **częściowo nieaktualny** | sprzeczność z kodem co do okna tygodnia — do rozstrzygnięcia (D9) |
| `progress-training-analysis.json` | **częściowo nieaktualny** | sekcja `tabs` historyczna (kod: Przegląd, Siła, Sylwetka, Tygodnie); obowiązuje tylko dla formuł i eligibility, układ ekranów wg `progress-screens.json` |
| `performance-intelligence-engine-v2.md` | **w większości niezrealizowany** | wizja; zrealizowane silniki opisuje `analytics-intelligence.json` |

Przy zmianie kodu opisanego przez plik z tabeli — zaktualizuj plik i tę tabelę.

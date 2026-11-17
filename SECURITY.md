# Polityka bezpieczeństwa GymBrat

## Zgłaszanie podatności (koordynowane ujawnianie)

Podatność zgłoś **prywatnie** przez GitHub:
<https://github.com/damianchmielewski33-cmyk/GymBrat/security/advisories/new>

Nie opisuj podatności w publicznych issue ani PR. Podaj: wersję (`GET /api/version`), kroki odtworzenia, wpływ. Nie podawaj cudzych danych osobowych.

| Etap | Cel |
|---|---|
| Potwierdzenie zgłoszenia | do 5 dni roboczych |
| Wstępna ocena (waga, zakres) | do 10 dni roboczych |
| Poprawka krytycznej/wysokiej podatności | do 14 dni od oceny |
| Poprawka średniej/niskiej | w najbliższym wydaniu |
| Publiczne ujawnienie | po wdrożeniu poprawki, uzgodnione ze zgłaszającym |

Działania w dobrej wierze (bez niszczenia danych, bez dostępu do kont innych osób, bez DoS) nie będą podstawą do kroków prawnych.

## Wspierane wersje i okres wsparcia

Aktualizacje bezpieczeństwa otrzymuje wyłącznie najnowsza wersja produkcyjna (`master`; aplikacja webowa aktualizuje się dla wszystkich użytkowników jednocześnie). Aplikacja Android (APK) – wspierana jest najnowsza wersja z `public/android-version.json`; starsze należy zaktualizować. Deklarowany okres wsparcia: min. 5 lat od wydania lub do wycofania produktu (wcześniejsze wycofanie zostanie zapowiedziane w aplikacji i changelogu).

## Obsługa podatności i aktualizacje

- Zależności: Dependabot + `npm audit` (blokuje High/Critical) + przegląd zależności w PR (`.github/workflows/dependency-security.yml`).
- SBOM (CycloneDX) generowany w CI przy każdym przebiegu i dołączany jako artefakt.
- Poprawki bezpieczeństwa są oznaczane w changelogu aplikacji.
- Aktywnie wykorzystywane podatności i poważne incydenty zgłaszane są do CSIRT/ENISA zgodnie z CRA (procedura: `docs/bezpieczenstwo/cra.md`).

Szczegóły zgodności z CRA: `docs/zgodnosc/cra.md`.

# Cyber Resilience Act (CRA) – mapa zgodności GymBrat

Status: wersja robocza techniczna. **Nie jest poradą prawną.** Czy i w jakim zakresie GymBrat podlega CRA (SaaS web vs. produkt z elementami cyfrowymi – apka Android/APK), potwierdza właściciel z prawnikiem. Obowiązki raportowe od 11.09.2026, pozostałe od 11.12.2027.

## Mapa wymagań

| Wymaganie CRA | Realizacja | Stan |
|---|---|---|
| Punkt kontaktowy + polityka CVD | `SECURITY.md`, `public/.well-known/security.txt` (kontakt: GitHub private advisories) | ✅ |
| SBOM | Job `sbom` w `dependency-security.yml` (CycloneDX, artefakt 90 dni) | ✅ |
| Obsługa podatności w zależnościach | Dependabot, `npm audit --audit-level=high`, dependency review | ✅ |
| Aktualizacje bezpieczeństwa | Wdrożenie `master` → Preview → Promote; changelog; `GET /api/version` | ✅ |
| Okres wsparcia | Deklaracja w `SECURITY.md` | ✅ (do zatwierdzenia przez właściciela) |
| Bezpieczna konfiguracja domyślna, sekrety | `lib/admin-config-status.ts`, `docs/bezpieczenstwo/rotacja-sekretow.md` | ✅ |
| Ocena ryzyka | `docs/bezpieczenstwo/00-model-zagrozen-bazowy.md` + analizy per funkcja | ✅ |
| Raportowanie do CSIRT/ENISA | Procedura niżej | ⚠️ właściciel zgłasza się na platformie |
| Dokumentacja techniczna, deklaracja zgodności UE, oznakowanie CE | – | ⛔ `[NA KONIEC]` (właściciel; zależy od klasyfikacji) |

## Procedura: aktywnie wykorzystywana podatność / poważny incydent

1. Stwierdzenie (zgłoszenie CVD, monitoring, Sentry) → właściciel w ciągu 1 dnia roboczego.
2. **Wczesne ostrzeżenie** do CSIRT/ENISA: do 24 h od stwierdzenia.
3. **Powiadomienie** z oceną i środkami zaradczymi: do 72 h.
4. **Raport końcowy**: do 14 dni od dostępności poprawki (podatność) / 1 miesiąc (incydent).
5. Poprawka na `master` → Promote → wpis w changelogu; poinformowanie użytkowników w aplikacji.
6. Dane osobowe w incydencie: równolegle ocena zgłoszenia do UODO (72 h, RODO).

## Utrzymanie

- `security.txt`: odnowić `Expires` najpóźniej 2027-11-01.
- Przegląd SBOM i polityki: raz na kwartał.

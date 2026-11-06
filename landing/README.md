# GymBrat — strona reklamowa (Astro)

Osobny projekt statyczny (własny `package.json`); docelowo przeniesiony do osobnego repo na własną domenę `[DOMENA]`. Aplikacja działa pod `app.[DOMENA]`.

```bash
cd landing
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/
```

## Zmienne (patrz `.env.example`)
- `PUBLIC_SITE_URL` — adres landingu (canonical, sitemap).
- `PUBLIC_APP_URL` — adres aplikacji: formularz `POST /api/waitlist`, logowanie, regulamin, polityka. Lokalnie `http://localhost:3000`.
- `PUBLIC_HERO_VIDEO`, `PUBLIC_HERO_POSTER` — opcjonalny film MP4 w hero (plik w `public/`). Bez nich działa interaktywne demo serii. Przycisk „Włącz dźwięk” pojawia się tylko, gdy film jest ustawiony; dźwięk tylko po kliknięciu.

## Po stronie aplikacji (repo GymBrat)
- `NEXT_PUBLIC_LANDING_URL` = adres landingu: włącza CORS tylko z tej domeny dla `POST /api/waitlist` i przekierowanie `/start`.
- Zapis wymaga SMTP (e-mail potwierdzający, double opt-in).

## Zasady
Bez wymyślonych statystyk i opinii; dane w demo są oznaczone jako przykład; `prefers-reduced-motion` wyłącza ruch; brak przycisków zakupu (decyzja o płatnościach na Androidzie jest otwarta). Placeholdery `[CENA]`, `[NAZWA PAKIETU]`, `[DOMENA]` do uzupełnienia przed publikacją. Treść zgody i okresy retencji listy powiadomień: projekt, wymagają zatwierdzenia prawnika.

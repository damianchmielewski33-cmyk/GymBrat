# Przepięcie GymBrat na Hetzner — plan i instrukcje konfiguracji

Dokument wykonawczy poza repo do [`vps-docker-production.md`](vps-docker-production.md) (Faza 1, D1 = Hetzner).

**Pliki w repo (już są):** [`deployment.md`](deployment.md), `Dockerfile`, `deploy/docker-compose.yml`, `deploy/Caddyfile`, `.github/workflows/deploy-vps.yml`.

Ten dokument = czynności na koncie Hetzner / Cloudflare / SMTP. **Nie wyłączaj Render** aż staging przejdzie checklistę w [`staging.md`](staging.md) i dasz GO-LIVE.

---

## 0. Skrócony plan przepięcia (kolejność obowiązkowa)

1. Konto Hetzner + serwer (rozdz. 1).
2. Hardening serwera: SSH, firewall, auto-aktualizacje (rozdz. 2).
3. Domena + Cloudflare DNS, najpierw dla `staging.<domena>` (rozdz. 3).
4. Docker + Docker Compose na serwerze (rozdz. 4).
5. Dostawca SMTP (Brevo/SES/Mailgun) — konto + domena nadawcza SPF/DKIM/DMARC (rozdz. 5).
6. Zestaw zmiennych środowiskowych produkcyjnych, zapisany **poza repo** (rozdz. 6).
7. Deploy obrazu z GHCR na VPS ([`deployment.md`](deployment.md)) → staging.
8. Checklist staging ([`staging.md`](staging.md)) → zgoda GO-LIVE → cutover DNS produkcji → APK na ten sam origin.
9. **Dopiero wtedy** wyłączenie Render Free jako produkcji.

Punkty 1–6 = infrastruktura poza git. Punkt 7 = `docker compose` + sekrety Actions. Punkt 9 = zakaz przed zielonym stagingiem.

---

## 1. Serwer Hetzner

### 1.1 Konto
- Rejestracja: https://www.hetzner.com/cloud — karta płatnicza lub PayPal, weryfikacja telefonu.
- Hetzner czasem wymaga manualnej weryfikacji konta dla nowych klientów (1–24 h) — **zrób to z wyprzedzeniem**, nie w dniu cutoveru.

### 1.2 Typ serwera (zgodnie z D3 w `vps-docker-production.md`)
- **Start (Faza 1, ~100–300 userów):** `CX22` (2 vCPU, 4 GB RAM, 40 GB SSD) — ok. 4–5 €/mies.
- Lokalizacja: `Falkenstein` lub `Nürnberg` (Niemcy) — najniższe opóźnienia do Polski.
- Obraz: Ubuntu 24.04 LTS.
- Przy tworzeniu serwera: dodaj **klucz SSH** (nie ustawiaj hasła roota — patrz 2.1).
- Opcjonalnie: włącz Hetzner Cloud Firewall (dodatkowa warstwa, patrz 2.2) i Backups (automatyczne snapshoty, dopłata ~20% ceny serwera) — zalecane od razu.

### 1.3 Skalowanie w górę później
Zmiana typu serwera w Hetzner Cloud to jedna operacja z restartem (pionowe skalowanie) — nie trzeba
tego rozstrzygać teraz. Faza 2/3 (`vps-docker-production.md` §0) przewiduje przejście na 8 GB przy wzroście.

---

## 2. Hardening serwera (zanim pójdzie tam cokolwiek produkcyjne)

### 2.1 SSH tylko kluczem
```bash
# z Twojego komputera, pierwsze logowanie:
ssh root@<IP_SERWERA>

# na serwerze: wyłącz logowanie hasłem
sudo nano /etc/ssh/sshd_config
# ustaw: PasswordAuthentication no
#        PermitRootLogin prohibit-password
sudo systemctl restart sshd
```
Utwórz też użytkownika bez roota do codziennej pracy (`adduser deploy && usermod -aG sudo deploy`) — root tylko do awaryjnych sytuacji.

### 2.2 Firewall (UFW)
```bash
sudo apt update && sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```
Dodatkowo w panelu Hetzner Cloud: Firewall → reguły wejściowe tylko na 22/80/443, przypisany do serwera (druga warstwa, niezależna od UFW).

### 2.3 Fail2Ban i automatyczne aktualizacje
```bash
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure --priority=low unattended-upgrades   # wybierz "Yes"
```

### 2.4 Monitoring zasobów (podstawowy)
Hetzner Cloud ma wbudowany wykres CPU/RAM/dysk/sieć w panelu — wystarczający na Fazę 1. Alertowanie (próg 80%) to Faza 2.

---

## 3. Domena i Cloudflare DNS

### 3.1 Domena (D8 w `vps-docker-production.md` — trzeba wybrać/potwierdzić)
Jeśli nie masz jeszcze domeny: rejestracja u dowolnego rejestratora (np. OVH, Namecheap, home.pl) —
nie musi to być Cloudflare, Cloudflare obsłuży tylko DNS.

### 3.2 Podłączenie do Cloudflare (plan Free)
1. Dodaj domenę w panelu Cloudflare → Cloudflare pokaże 2 nameservery.
2. Zmień nameservery domeny u rejestratora na te z Cloudflare (propagacja do 24 h, zwykle szybciej).
3. W Cloudflare DNS dodaj rekordy:
   - `A  staging   <IP_SERWERA>`  — Proxy: **włączony** (pomarańczowa chmurka)
   - `A  @         <IP_SERWERA>`  — Proxy: włączony (dodaj dopiero przed cutoverem produkcji, patrz rozdz. 8)
   - `A  www       <IP_SERWERA>`  — Proxy: włączony (redirect do `@`, jeśli chcesz `www`)
4. SSL/TLS → **Full (strict)** (wymaga certyfikatu na origin — Caddy go wygeneruje automatycznie przy implementacji).
5. SSL/TLS → Edge Certificates → **Always Use HTTPS**: włączone, **HSTS**: włączone (ostrożnie — włączaj HSTS dopiero gdy HTTPS stabilnie działa).
6. Security → WAF: domyślne ustawienia Free + "Bot Fight Mode": włączony.
7. Caching → Browser Cache TTL: domyślne; cache statycznych assetów Next.js ustawi się dopiero przy implementacji (Cache Rules w Fazie 1 §6).

---

## 4. Docker na serwerze

```bash
# instalacja Docker Engine + Compose plugin (Ubuntu 24.04)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy   # użytkownik bez roota z 2.1
docker compose version          # weryfikacja
```
Repozytorium obrazów: GitHub Container Registry (GHCR) — token dostępu (PAT z zakresem `write:packages`/`read:packages`) zostanie potrzebny przy konfiguracji CI/CD (krok kodowy, poza tym dokumentem).

---

## 5. Dostawca SMTP (do e-maili rejestracyjnych)

Decyzja z wcześniejszej rozmowy: **Brevo** (EU/RODO-friendly, 300 maili/dzień darmowo) jako domyślna propozycja; alternatywy: Resend, Amazon SES, Mailgun.

1. Rejestracja konta u wybranego dostawcy, podpisanie DPA (umowa powierzenia danych) — wymagane przed produkcją.
2. Zweryfikuj domenę nadawczą (np. `mail.twojadomenagymbrat.pl` lub subdomenę) u dostawcy — poda rekordy do wklejenia w Cloudflare DNS:
   - `TXT` SPF
   - `CNAME`/`TXT` DKIM (zwykle 2–3 rekordy)
   - `TXT` DMARC (`_dmarc.<domena>`)
3. Wygeneruj dane SMTP (host, port 587, user, hasło/API key) u dostawcy.
4. Zapisz je jako zmienne środowiskowe (rozdz. 6) — **nie wklejaj ich do żadnego pliku w repo**.

---

## 6. Zmienne środowiskowe produkcji (poza repo)

Na serwerze (lub w sekretach GitHub Actions — ustalane przy kroku CI/CD) musi istnieć plik `.env`
zgodny z [`env.example`](../env.example), wypełniony wartościami produkcyjnymi. Minimalny zestaw na Fazę 1:

| Zmienna | Wartość |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | z panelu Turso (baza produkcyjna, osobna od lokalnej) |
| `AUTH_SECRET` | nowy, losowy sekret (np. `openssl rand -base64 32`) |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL` | `https://<domena>` — ten sam origin co APK (SSoT URL) |
| `APP_ENCRYPTION_KEY` | losowy klucz AES-256 — wymagany, inaczej dane wrażliwe nie zapisują się (fail closed) |
| `ADMIN_EMAILS` | Twój e-mail właściciela |
| `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`, `SMTP_PASS` | z rozdz. 5 |
| `CRON_SECRET` | losowy sekret do `/api/cron/cleanup` |
| OAuth (`AUTH_GOOGLE_*`, `AUTH_FACEBOOK_*`) | jeśli logowanie społecznościowe włączone — redirect URI zaktualizowany na nowy origin |

**Zasada:** ten `.env` nigdy nie trafia do git. Backup tego pliku (zaszyfrowany) poza serwerem to pozycja z Fazy 2 (§3 `vps-docker-production.md`).

---

## 7. Krok kodowy (zrobiony w repo)

Zobacz [`deployment.md`](deployment.md). Na VPS: skopiuj `deploy/*`, uzupełnij `.env`, ustaw sekrety `VPS_*` w GitHub, odpal workflow **Deploy VPS (Docker)**.

Aktualizacja `lib/android-version.ts` i `android/gradle.properties` na nowy origin — **dopiero po GO staging** (§7 / §10 `vps-docker-production.md`).

---

## 8. Checklist przed cutoverem produkcji

Zgodnie z §8 `vps-docker-production.md`, powtórzona tu w skrócie dla Hetznera:
- [ ] Serwer odpowiada na `staging.<domena>` przez HTTPS, brak ekranu Render wake-up.
- [ ] Login + sesja działają na stagingu.
- [ ] `GET /api/version` zwraca poprawne dane (provenance GymBrat).
- [ ] Test maila rejestracyjnego ze stagingu dociera (nie do spamu — sprawdź SPF/DKIM/DMARC).
- [ ] Restart serwera → `docker compose up -d` wraca samo (`restart: unless-stopped`).
- [ ] Rollback do poprzedniego tagu obrazu przetestowany raz na stagingu.
- Po zielonym stagingu i Twojej zgodzie: DNS produkcji → OAuth redirect → APK rebuild na ten sam origin → wyłączenie Render Free.

---

## 9. Czego wciąż potrzebuję od Ciebie (dane właściciela)

- Domena produkcyjna (D8) — jeśli jeszcze nie wybrana.
- Decyzja, czy backups Hetznera (snapshoty) włączamy od razu (dopłata ~20%).
- Wybór dostawcy SMTP, jeśli nie Brevo.
- Zgoda na start kroku kodowego z rozdz. 7, gdy będziesz gotowy.

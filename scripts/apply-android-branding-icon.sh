#!/usr/bin/env bash
# Pobiera ikonę Android z publicznego API brandingu i podmienia foreground launchera.
# Bez zmian w kodzie — asset z panelu Admin → Branding → icon_android.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${1:-https://gym-brat.vercel.app/}"
case "$API_BASE" in
  */) ;;
  *) API_BASE="${API_BASE}/" ;;
esac

OUT_DIR="$ROOT/android/app/src/main/res/drawable"
mkdir -p "$OUT_DIR"
TMP="$(mktemp)"
URL="${API_BASE}api/branding/asset/icon_android"

echo "[apply-android-branding-icon] GET $URL"
HTTP_CODE="$(curl -sS -o "$TMP" -w "%{http_code}" "$URL" || true)"
if [ "$HTTP_CODE" != "200" ]; then
  echo "[apply-android-branding-icon] Brak custom ikony (HTTP $HTTP_CODE) — zostawiam domyślną."
  rm -f "$TMP"
  exit 0
fi

MIME="$(file -b --mime-type "$TMP" || true)"
case "$MIME" in
  image/png)
    cp "$TMP" "$OUT_DIR/ic_launcher_foreground.png"
    # Adaptive icon XML wskazuje na drawable — przełącz na PNG
    cat > "$ROOT/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
EOF
    cp "$ROOT/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" \
      "$ROOT/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml"
    # Usuń wektorowy foreground, jeśli jest — Android preferuje tą samą nazwę; PNG wygrywa nad XML przy konflikcie nazw w niektórych setupach — lepiej usunąć XML.
    if [ -f "$OUT_DIR/ic_launcher_foreground.xml" ]; then
      mv "$OUT_DIR/ic_launcher_foreground.xml" "$OUT_DIR/ic_launcher_foreground.xml.bak"
    fi
    echo "[apply-android-branding-icon] OK — PNG foreground z brandingu"
    ;;
  *)
    echo "[apply-android-branding-icon] Nieobsługiwany typ ($MIME) — pomijam (użyj PNG)."
    ;;
esac
rm -f "$TMP"

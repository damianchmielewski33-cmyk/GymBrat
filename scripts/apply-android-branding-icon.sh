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
MIPMAP_DIR="$ROOT/android/app/src/main/res/mipmap-anydpi-v26"
mkdir -p "$OUT_DIR" "$MIPMAP_DIR"
TMP="$(mktemp)"
URL="${API_BASE}api/branding/asset/icon_android"
PNG_OUT="$OUT_DIR/ic_launcher_foreground.png"

echo "[apply-android-branding-icon] GET $URL"
HTTP_CODE="$(curl -sS -o "$TMP" -w "%{http_code}" "$URL" || true)"
if [ "$HTTP_CODE" != "200" ]; then
  echo "[apply-android-branding-icon] Brak custom ikony (HTTP $HTTP_CODE) — zostawiam domyślną."
  rm -f "$TMP"
  exit 0
fi

MIME="$(file -b --mime-type "$TMP" || true)"
echo "[apply-android-branding-icon] MIME=$MIME size=$(wc -c < "$TMP")B"

write_adaptive_xml() {
  cat > "$MIPMAP_DIR/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
EOF
  cp "$MIPMAP_DIR/ic_launcher.xml" "$MIPMAP_DIR/ic_launcher_round.xml"
}

# Usuń wszystkie warianty foreground, żeby nie było duplikatu resource.
clear_foreground_variants() {
  rm -f \
    "$OUT_DIR/ic_launcher_foreground.xml" \
    "$OUT_DIR/ic_launcher_foreground.xml.bak" \
    "$OUT_DIR/ic_launcher_foreground.webp" \
    "$OUT_DIR/ic_launcher_foreground.jpg" \
    "$OUT_DIR/ic_launcher_foreground.jpeg" \
    "$PNG_OUT"
}

to_png_432() {
  local src="$1"
  # Preferuj Pillow (stabilny RGBA PNG 432×432 pod adaptive icon).
  if python3 - <<PY
from PIL import Image
im = Image.open(r'''$src''').convert("RGBA")
im = im.resize((432, 432), Image.Resampling.LANCZOS)
im.save(r'''$PNG_OUT''', format="PNG", optimize=True)
print("pillow-ok", im.size)
PY
  then
    return 0
  fi
  case "$MIME" in
    image/png)
      cp "$src" "$PNG_OUT"
      ;;
    image/webp)
      if command -v dwebp >/dev/null 2>&1; then
        dwebp "$src" -o "$PNG_OUT"
      else
        echo "[apply-android-branding-icon] Brak Pillow/dwebp — nie mogę skonwertować WebP."
        return 1
      fi
      ;;
    image/jpeg|image/jpg)
      if command -v magick >/dev/null 2>&1; then
        magick "$src" -resize 432x432 "$PNG_OUT"
      elif command -v convert >/dev/null 2>&1; then
        convert "$src" -resize 432x432 "$PNG_OUT"
      else
        echo "[apply-android-branding-icon] Brak konwertera JPEG."
        return 1
      fi
      ;;
    *)
      echo "[apply-android-branding-icon] Nieobsługiwany typ ($MIME)."
      return 1
      ;;
  esac
  return 0
}

case "$MIME" in
  image/png|image/webp|image/jpeg|image/jpg)
    clear_foreground_variants
    if ! to_png_432 "$TMP"; then
      echo "[apply-android-branding-icon] Konwersja nieudana — zostawiam domyślną ikonę."
      rm -f "$TMP" "$PNG_OUT"
      exit 0
    fi
    if [ ! -s "$PNG_OUT" ]; then
      echo "[apply-android-branding-icon] Pusty PNG — zostawiam domyślną."
      rm -f "$TMP" "$PNG_OUT"
      exit 0
    fi
    write_adaptive_xml
    echo "[apply-android-branding-icon] OK — PNG foreground ($(wc -c < "$PNG_OUT")B)"
    file "$PNG_OUT" || true
    ;;
  *)
    echo "[apply-android-branding-icon] Nieobsługiwany typ ($MIME) — pomijam (użyj PNG/WebP)."
    ;;
esac
rm -f "$TMP"

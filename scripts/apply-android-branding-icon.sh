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
  # To samo PNG jako tło i foreground — kafelek launchera wypełniony logo
  # (bez „pływającej” ramki z samego foreground + koloru tła).
  cat > "$MIPMAP_DIR/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_foreground" />
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
  # Preferuj Pillow: obetnij przezroczystą/białą ramkę i wypełnij cały 432×432
  # (bez „pływającego” logo na launcherze / adaptive icon).
  if python3 - <<PY
from PIL import Image

SRC = r'''$src'''
OUT = r'''$PNG_OUT'''
SIZE = 432
BG = (5, 5, 5, 255)  # = ic_launcher_background


def is_padding(px):
    r, g, b, a = px
    if a < 16:
        return True
    # Biała / prawie biała ramka z eksportów Canva / Figma
    if r >= 235 and g >= 235 and b >= 235:
        return True
    return False


def trim_padding(im):
    px = im.load()
    w, h = im.size
    step_x = max(1, w // 120)
    step_y = max(1, h // 120)

    def row_pad(y: int) -> bool:
        return all(is_padding(px[x, y]) for x in range(0, w, step_x))

    def col_pad(x: int) -> bool:
        return all(is_padding(px[x, y]) for y in range(0, h, step_y))

    top = 0
    while top < h and row_pad(top):
        top += 1
    bottom = h - 1
    while bottom > top and row_pad(bottom):
        bottom -= 1
    left = 0
    while left < w and col_pad(left):
        left += 1
    right = w - 1
    while right > left and col_pad(right):
        right -= 1

    if right - left < w * 0.2 or bottom - top < h * 0.2:
        return im
    return im.crop((left, top, right + 1, bottom + 1))


def cover_resize(im, size):
    """Wypełnij kwadrat (cover) — bez letterboxingu."""
    w, h = im.size
    if w <= 0 or h <= 0:
        return Image.new("RGBA", (size, size), BG)
    scale = max(size / w, size / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - size) // 2
    top = (nh - size) // 2
    return resized.crop((left, top, left + size, top + size))


im = Image.open(SRC).convert("RGBA")
before = im.size
im = trim_padding(im)
after_trim = im.size
im = cover_resize(im, SIZE)
canvas = Image.new("RGBA", (SIZE, SIZE), BG)
canvas.alpha_composite(im)
# Nieprzezroczysty PNG — launcher nie „prześwieca” tapety w rogach.
out = canvas.convert("RGB")
out.save(OUT, format="PNG", optimize=True)
print("pillow-ok", before, "-> trim", after_trim, "->", out.size)
PY
  then
    return 0
  fi
  echo "[apply-android-branding-icon] Pillow niedostępny — próbuję fallback."
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
        magick "$src" -resize 432x432^ -gravity center -extent 432x432 -background "#050505" "$PNG_OUT"
      elif command -v convert >/dev/null 2>&1; then
        convert "$src" -resize 432x432^ -gravity center -extent 432x432 -background "#050505" "$PNG_OUT"
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

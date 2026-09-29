/**
 * Pobiera najnowszy gymbrat.apk z GitHub Release do public/,
 * żeby Vercel serwował go same-origin (Chrome na Androidzie nie wisi na 100%).
 */
import { createWriteStream } from "node:fs";
import { access, mkdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "gymbrat.apk");
const SOURCE =
  process.env.ANDROID_APK_URL?.trim() ||
  "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/download/android-latest/gymbrat.apk";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(dirname(OUT), { recursive: true });
  console.log(`[fetch-android-apk] Źródło: ${SOURCE}`);
  console.log(`[fetch-android-apk] Cel: ${OUT}`);

  const res = await fetch(SOURCE, {
    redirect: "follow",
    headers: {
      Accept: "application/vnd.android.package-archive,*/*",
      "User-Agent": "GymBrat-Vercel-Build-Fetch-APK",
    },
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok || !res.body) {
    const msg = `[fetch-android-apk] HTTP ${res.status}`;
    if (await exists(OUT)) {
      console.warn(`${msg} — zostawiam istniejący public/gymbrat.apk`);
      return;
    }
    throw new Error(msg);
  }

  const tmp = `${OUT}.tmp`;
  try {
    await pipeline(res.body, createWriteStream(tmp));
    const st = await stat(tmp);
    if (st.size < 50_000) {
      await unlink(tmp).catch(() => {});
      throw new Error(`[fetch-android-apk] Plik za mały (${st.size} B)`);
    }
    await unlink(OUT).catch(() => {});
    const { rename } = await import("node:fs/promises");
    await rename(tmp, OUT);
    console.log(`[fetch-android-apk] OK ${(st.size / (1024 * 1024)).toFixed(2)} MB`);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    if (await exists(OUT)) {
      console.warn(`[fetch-android-apk] Błąd pobierania, używam istniejącego APK:`, e);
      return;
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

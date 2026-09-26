import bundled from "@/public/android-version.json";
import { GYMBRAT_GITHUB_SLUG } from "@/lib/gymbrat-source";

export type AndroidVersionInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releasedAt?: string | null;
  commit?: string | null;
  notes?: string | null;
};

const DEFAULT_GYMBRAT_VERSION_JSON = `https://github.com/${GYMBRAT_GITHUB_SLUG}/releases/download/android-latest/android-version.json`;
const DEFAULT_GYMBRAT_APK = `https://github.com/${GYMBRAT_GITHUB_SLUG}/releases/download/android-latest/gymbrat.apk`;

const FOREIGN_ANDROID_MARKERS = [
  "akademia-wielkich-pi",
  "akademia-wp.apk",
  "akademia_wp",
] as const;

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function asHttpUrl(value: unknown): string | null {
  const t = asNonEmptyString(value);
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** APK / JSON Akademii nie może sterować aktualizacją GymBrat. */
export function isForeignAndroidArtifactUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return FOREIGN_ANDROID_MARKERS.some((marker) => lower.includes(marker));
}

export function isGymBratAndroidSourceUrl(url: string | null | undefined): boolean {
  if (!url || isForeignAndroidArtifactUrl(url)) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("github.com/damianchmielewski33-cmyk/gymbrat") ||
    lower.includes("gym-brat.vercel.app") ||
    lower.includes("/gymbrat.apk")
  );
}

/** Akceptuje też versionCode jako string — GitHub/CDN bywa niekonsekwentny. */
export function parseAndroidVersionInfo(raw: unknown): AndroidVersionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const versionCode = asPositiveInt(o.versionCode);
  const versionName = asNonEmptyString(o.versionName);
  const rawApk = asHttpUrl(o.apkUrl);
  if (isForeignAndroidArtifactUrl(rawApk)) return null;
  const apkUrl = rawApk ?? defaultApkUrl();
  if (isForeignAndroidArtifactUrl(apkUrl)) return null;
  if (versionCode == null || !versionName) return null;
  const releasedAt = asNonEmptyString(o.releasedAt);
  const commit = asNonEmptyString(o.commit);
  const notes = typeof o.notes === "string" ? o.notes : null;
  return {
    versionCode,
    versionName,
    apkUrl,
    releasedAt: releasedAt ?? null,
    commit: commit ?? null,
    notes,
  };
}

export function defaultApkUrl(): string {
  const fromEnv =
    asHttpUrl(process.env.ANDROID_APK_URL) ||
    asHttpUrl(process.env.NEXT_PUBLIC_ANDROID_APK_URL);
  if (fromEnv && !isForeignAndroidArtifactUrl(fromEnv)) return fromEnv;
  return DEFAULT_GYMBRAT_APK;
}

export function bundledAndroidVersion(): AndroidVersionInfo {
  const parsed = parseAndroidVersionInfo(bundled);
  if (parsed) return { ...parsed, apkUrl: parsed.apkUrl || defaultApkUrl() };
  const pkg = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.6";
  return {
    versionCode: 7,
    versionName: pkg,
    apkUrl: defaultApkUrl(),
    notes: "Wbudowana informacja o wersji GymBrat (fallback).",
  };
}

/**
 * Tylko źródła GymBrat: env (jeśli nie AWP) → GitHub Release GymBrat → bundled.
 */
function versionJsonUrls(): string[] {
  const urls: string[] = [];
  const fromEnv = asHttpUrl(process.env.ANDROID_VERSION_JSON_URL);
  if (fromEnv && isGymBratAndroidSourceUrl(fromEnv)) urls.push(fromEnv);
  urls.push(DEFAULT_GYMBRAT_VERSION_JSON);
  return [...new Set(urls)];
}

async function fetchVersionCandidate(url: string): Promise<AndroidVersionInfo | null> {
  if (isForeignAndroidArtifactUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "GymBrat-Android-Version",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const info = parseAndroidVersionInfo(parsed);
    if (!info || isForeignAndroidArtifactUrl(info.apkUrl)) return null;
    return info;
  } catch {
    return null;
  }
}

/**
 * Źródła: env → GitHub Release GymBrat → bundled public/android-version.json.
 * Bierzemy kandydata z najwyższym versionCode (stary release nie może
 * zasłaniać nowszego bundled / odwrotnie).
 * Nigdy nie bierzemy wersji ani APK Akademii Wielkich Piłkarzy.
 */
export async function resolveAndroidVersion(): Promise<AndroidVersionInfo> {
  const candidates: AndroidVersionInfo[] = [];
  for (const url of versionJsonUrls()) {
    const info = await fetchVersionCandidate(url);
    if (info) candidates.push(info);
  }
  candidates.push(bundledAndroidVersion());

  let best = candidates[0]!;
  for (const c of candidates) {
    if (c.versionCode > best.versionCode) best = c;
  }
  return best;
}

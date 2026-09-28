import bundled from "@/public/android-version.json";
import { GYMBRAT_GITHUB_OWNER, GYMBRAT_GITHUB_REPO } from "@/lib/gymbrat-source";

export type AndroidVersionInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releasedAt?: string | null;
  commit?: string | null;
  notes?: string | null;
};

const GYMBRAT_RELEASE_BASE = `https://github.com/${GYMBRAT_GITHUB_OWNER}/${GYMBRAT_GITHUB_REPO}/releases/download/android-latest`;

const DEFAULT_GITHUB_VERSION_JSON = `${GYMBRAT_RELEASE_BASE}/android-version.json`;
const DEFAULT_GITHUB_APK = `${GYMBRAT_RELEASE_BASE}/gymbrat.apk`;

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

/** True, gdy APK / JSON pochodzi z release’ów GymBrat (nie AWP). */
export function isGymBratAndroidAssetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com" && u.hostname !== "objects.githubusercontent.com") {
      return false;
    }
    return u.pathname.includes(`/${GYMBRAT_GITHUB_OWNER}/${GYMBRAT_GITHUB_REPO}/`);
  } catch {
    return false;
  }
}

/** Akceptuje też versionCode jako string — GitHub/CDN bywa niekonsekwentny. */
export function parseAndroidVersionInfo(raw: unknown): AndroidVersionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const versionCode = asPositiveInt(o.versionCode);
  const versionName = asNonEmptyString(o.versionName);
  const apkUrl = asHttpUrl(o.apkUrl) ?? defaultApkUrl();
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
  return (
    asHttpUrl(process.env.ANDROID_APK_URL) ||
    asHttpUrl(process.env.NEXT_PUBLIC_ANDROID_APK_URL) ||
    DEFAULT_GITHUB_APK
  );
}

export function bundledAndroidVersion(): AndroidVersionInfo {
  const parsed = parseAndroidVersionInfo(bundled);
  if (parsed) {
    const apkUrl =
      isGymBratAndroidAssetUrl(parsed.apkUrl) || process.env.ANDROID_APK_URL
        ? parsed.apkUrl
        : defaultApkUrl();
    return { ...parsed, apkUrl };
  }
  const pkg = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.5";
  return {
    versionCode: 6,
    versionName: pkg,
    apkUrl: defaultApkUrl(),
    notes: "Wbudowana informacja o wersji GymBrat (fallback).",
  };
}

function versionJsonUrls(): string[] {
  const urls: string[] = [];
  const fromEnv = asHttpUrl(process.env.ANDROID_VERSION_JSON_URL);
  if (fromEnv) urls.push(fromEnv);
  urls.push(DEFAULT_GITHUB_VERSION_JSON);
  // Publiczny plik tego deploymentu (ta sama origin co /api/android/version).
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL.trim()) {
    urls.push(`https://${process.env.VERCEL_URL.trim()}/android-version.json`);
  }
  return [...new Set(urls)];
}

async function fetchVersionCandidate(url: string): Promise<AndroidVersionInfo | null> {
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
    if (!info) return null;
    const allowForeignApk = Boolean(asHttpUrl(process.env.ANDROID_APK_URL));
    if (!allowForeignApk && !isGymBratAndroidAssetUrl(info.apkUrl)) {
      return null;
    }
    return info;
  } catch {
    return null;
  }
}

/**
 * Źródła (kolejno): env → GitHub Releases GymBrat → bundled JSON.
 * Nigdy AWP — wersja i APK muszą pochodzić z repozytorium GymBrat.
 */
export async function resolveAndroidVersion(): Promise<AndroidVersionInfo> {
  for (const url of versionJsonUrls()) {
    const info = await fetchVersionCandidate(url);
    if (info) return info;
  }
  return bundledAndroidVersion();
}

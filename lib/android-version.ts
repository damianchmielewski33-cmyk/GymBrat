import bundled from "@/public/android-version.json";

export type AndroidVersionInfo = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releasedAt?: string | null;
  commit?: string | null;
  notes?: string | null;
};

const DEFAULT_GITHUB_VERSION_JSON =
  "https://github.com/damianchmielewski33-cmyk/Akademia-Wielkich-Pi-karzy/releases/download/android-latest/android-version.json";

const DEFAULT_GITHUB_APK =
  "https://github.com/damianchmielewski33-cmyk/Akademia-Wielkich-Pi-karzy/releases/download/android-latest/akademia-wp.apk";

const DEFAULT_AWP_ORIGIN = "https://akademia-wielkich-pilkarzy.vercel.app";

function awpOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_AWP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_AWP_ORIGIN;
}

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
  if (parsed) return { ...parsed, apkUrl: parsed.apkUrl || defaultApkUrl() };
  const pkg = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";
  return {
    versionCode: 1,
    versionName: pkg,
    apkUrl: defaultApkUrl(),
    notes: "Wbudowana informacja o wersji (fallback).",
  };
}

function versionJsonUrls(): string[] {
  const urls: string[] = [];
  const fromEnv = asHttpUrl(process.env.ANDROID_VERSION_JSON_URL);
  if (fromEnv) urls.push(fromEnv);
  urls.push(DEFAULT_GITHUB_VERSION_JSON);
  const awp = awpOrigin();
  urls.push(`${awp}/android-version.json`);
  urls.push(`${awp}/api/android/version`);
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
    return parseAndroidVersionInfo(parsed);
  } catch {
    return null;
  }
}

/**
 * Źródła (kolejno): env → GitHub Releases AWP → pliki AWP → bundled JSON.
 * Bundled zawsze kończy łańcuch, żeby aplikacja Android nie dostała 503 / HTML logowania.
 */
export async function resolveAndroidVersion(): Promise<AndroidVersionInfo> {
  for (const url of versionJsonUrls()) {
    const info = await fetchVersionCandidate(url);
    if (info) return info;
  }
  return bundledAndroidVersion();
}

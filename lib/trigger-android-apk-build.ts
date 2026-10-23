import {
  GYMBRAT_GITHUB_OWNER,
  GYMBRAT_GITHUB_REPO,
} from "@/lib/gymbrat-source";

const WORKFLOW_FILE = "android-apk.yml";
const DEFAULT_REF = "master";
/** Produkcja tymczasowo na Renderze (Vercel Hobby w pauzie). */
const FALLBACK_API_BASE = "https://gymbrat.onrender.com/";

export type TriggerAndroidApkBuildResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: "missing_token" }
  | { ok: false; error: string };

function asBaseUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.origin}/`;
  } catch {
    return null;
  }
}

/** Publiczny origin strony, z którego build APK pobierze branding. */
export function resolveAndroidApiBaseUrl(req?: Request): string {
  const fromEnv =
    asBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    asBaseUrl(process.env.AUTH_URL) ||
    asBaseUrl(process.env.NEXTAUTH_URL) ||
    asBaseUrl(process.env.RENDER_EXTERNAL_URL) ||
    asBaseUrl(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null,
    );
  if (fromEnv) return fromEnv;

  if (req) {
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host")?.trim();
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
      const fromReq = asBaseUrl(`${proto}://${host}`);
      if (fromReq) return fromReq;
    }
  }

  return FALLBACK_API_BASE;
}

/**
 * Odpala GitHub Actions „Build Android APK” (workflow_dispatch).
 * Wymaga `GITHUB_APK_DISPATCH_TOKEN` (PAT z actions:write).
 * Bez tokena — skipped (upload brandingu i tak się uda).
 */
export async function triggerAndroidApkBuild(opts?: {
  apiBaseUrl?: string;
  ref?: string;
  req?: Request;
}): Promise<TriggerAndroidApkBuildResult> {
  const token = process.env.GITHUB_APK_DISPATCH_TOKEN?.trim();
  if (!token) {
    console.warn(
      "[trigger-android-apk-build] Brak GITHUB_APK_DISPATCH_TOKEN — pomijam dispatch.",
    );
    return { ok: true, skipped: true, reason: "missing_token" };
  }

  const apiBase =
    asBaseUrl(opts?.apiBaseUrl) ?? resolveAndroidApiBaseUrl(opts?.req);
  const ref = (opts?.ref ?? DEFAULT_REF).trim() || DEFAULT_REF;

  const url = `https://api.github.com/repos/${GYMBRAT_GITHUB_OWNER}/${GYMBRAT_GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: { api_base_url: apiBase },
      }),
    });

    if (res.status === 204 || res.ok) {
      return { ok: true };
    }

    const text = await res.text().catch(() => "");
    const error = `GitHub dispatch HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
    console.error("[trigger-android-apk-build]", error);
    return { ok: false, error };
  } catch (e) {
    const error = e instanceof Error ? e.message : "dispatch_failed";
    console.error("[trigger-android-apk-build]", error);
    return { ok: false, error };
  }
}

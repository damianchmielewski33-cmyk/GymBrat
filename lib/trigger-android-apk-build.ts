import {
  GYMBRAT_GITHUB_OWNER,
  GYMBRAT_GITHUB_REPO,
} from "@/lib/gymbrat-source";

const WORKFLOW_FILE = "android-apk.yml";
const DEFAULT_REF = "master";
const DEFAULT_API_BASE = "https://gym-brat.vercel.app/";

export type TriggerAndroidApkBuildResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

/**
 * Odpalá GitHub Actions „Build Android APK” (workflow_dispatch).
 * Wymaga `GITHUB_APK_DISPATCH_TOKEN` (PAT z actions:write).
 * Bez tokena — no-op (upload brandingu i tak się uda).
 */
export async function triggerAndroidApkBuild(opts?: {
  apiBaseUrl?: string;
  ref?: string;
}): Promise<TriggerAndroidApkBuildResult> {
  const token = process.env.GITHUB_APK_DISPATCH_TOKEN?.trim();
  if (!token) {
    console.warn(
      "[trigger-android-apk-build] Brak GITHUB_APK_DISPATCH_TOKEN — pomijam dispatch.",
    );
    return { ok: true, skipped: true, reason: "missing_token" };
  }

  let apiBase = (opts?.apiBaseUrl ?? DEFAULT_API_BASE).trim();
  if (!apiBase.endsWith("/")) apiBase = `${apiBase}/`;
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

/** Fire-and-forget — nie blokuje odpowiedzi HTTP na cały build APK. */
export function triggerAndroidApkBuildInBackground(opts?: {
  apiBaseUrl?: string;
  ref?: string;
}): void {
  void triggerAndroidApkBuild(opts).catch((err) => {
    console.error("[trigger-android-apk-build] background failed:", err);
  });
}

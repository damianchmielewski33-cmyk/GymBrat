/**
 * Lekki PostHog capture (HTTP) — bez SDK.
 * Działa server-side i w przeglądarce (beacon / fetch).
 *
 * Env:
 * - NEXT_PUBLIC_POSTHOG_KEY (lub POSTHOG_API_KEY) — project API key
 * - NEXT_PUBLIC_POSTHOG_HOST (domyślnie https://eu.i.posthog.com)
 */

type CaptureInput = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  groups?: Record<string, string>;
};

function getApiKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    process.env.POSTHOG_API_KEY?.trim() ||
    "";
  return key || null;
}

function getHost(): string {
  const raw =
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    process.env.POSTHOG_HOST?.trim() ||
    "https://eu.i.posthog.com";
  return raw.replace(/\/$/, "");
}

export function isPostHogConfigured(): boolean {
  return getApiKey() != null;
}

/**
 * Fire-and-forget capture. Nigdy nie rzuca — analityka nie może psuć UX.
 */
export async function posthogCapture(input: CaptureInput): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey || !input.distinctId || !input.event) return;

  const host = getHost();
  const props: Record<string, unknown> = {
    ...(input.properties ?? {}),
    distinct_id: input.distinctId,
    token: apiKey,
    $lib: "gymbrat-http",
  };
  if (input.groups && Object.keys(input.groups).length > 0) {
    props.$groups = input.groups;
  }

  const body = JSON.stringify({
    api_key: apiKey,
    event: input.event,
    properties: props,
    timestamp: new Date().toISOString(),
  });

  try {
    const res = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // Server: nie blokuj; Client: keepalive przy unload.
      keepalive: typeof window !== "undefined",
      cache: "no-store",
    });
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn("[posthog]", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[posthog] capture failed", err);
    }
  }
}

import webpush from "web-push";

/**
 * Web Push (VAPID). Klucze generujesz raz: `npx web-push generate-vapid-keys`.
 * Bez kluczy push jest wyłączony, a reszta przypomnień działa jak wcześniej.
 */
export function getVapidPublicKey(): string | null {
  const key = (
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  )?.trim();
  return key || null;
}

function getVapidPrivateKey(): string | null {
  return process.env.VAPID_PRIVATE_KEY?.trim() || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

function vapidSubject(): string {
  const explicit = process.env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app?.startsWith("https://")) return app;
  return "mailto:no-reply@gymbrat.app";
}

let configured = false;
function ensureConfigured(): boolean {
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(vapidSubject(), pub, priv);
    configured = true;
  }
  return true;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = {
  title: string;
  body: string;
  /** Ścieżka względna w aplikacji, np. /workout-plan. */
  url: string;
  tag: string;
};

export type PushResult = "ok" | "gone" | "error";

/** `gone` = subskrypcja wygasła (404/410) — należy ją usunąć z bazy. */
export async function sendWebPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureConfigured()) return "error";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60, urgency: "normal" },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}

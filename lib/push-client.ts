import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/actions/push";

/** Web Push w przeglądarce (Chrome, Edge, Firefox, Safari PWA). W WebView APK nie działa. */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing?.active?.scriptURL.endsWith("/push-sw.js")) return existing;
  await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** Czy ta przeglądarka ma już aktywną subskrypcję push. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return Boolean(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export type EnablePushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "error"; message: string };

export async function enableWebPush(vapidPublicKey: string): Promise<EnablePushResult> {
  if (!isWebPushSupported()) {
    return { ok: false, reason: "unsupported", message: "Ta przeglądarka nie obsługuje push." };
  }
  try {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      return {
        ok: false,
        reason: "denied",
        message: "Powiadomienia są zablokowane — odblokuj je w ustawieniach przeglądarki.",
      };
    }

    const reg = await getRegistration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const json = sub.toJSON();
    const saved = await savePushSubscriptionAction({
      endpoint: json.endpoint,
      keys: json.keys,
    });
    if (!saved.ok) return { ok: false, reason: "error", message: saved.error };
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Nie udało się włączyć powiadomień push. Spróbuj ponownie.",
    };
  }
}

export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await removePushSubscriptionAction(sub.endpoint);
    await sub.unsubscribe();
  } catch {
    /* subskrypcja i tak wygaśnie po stronie push service */
  }
}

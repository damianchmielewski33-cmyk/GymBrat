/* GymBrat — alias service workera powiadomień (ten sam kod co /sw.js).
 *
 * Starsze subskrypcje mogły zarejestrować /push-sw.js. Oba pliki muszą
 * zostawać zarejestrowane: PwaUpdate nie może ich kasować.
 */
const SW_VERSION = "gymbrat-push-2026-10-23";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve(SW_VERSION));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "GymBrat";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    tag: typeof data.tag === "string" ? data.tag : "gymbrat-reminder",
    data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

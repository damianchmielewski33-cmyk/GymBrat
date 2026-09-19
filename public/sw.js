/* GymBrat service worker — kill-switch.
 *
 * The old committed Workbox/next-pwa worker precached hashed `/_next/static/*`
 * files from a previous build. Because this file was not regenerated on deploy,
 * returning visitors kept running that worker and seeing stale production UI.
 *
 * This worker takes over, deletes those caches, unregisters itself, and reloads
 * open clients so the next navigation hits the network.
 */
const SW_VERSION = "gymbrat-kill-stale-2026-09-18";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve(SW_VERSION));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.all(
        windowClients.map((client) =>
          "navigate" in client ? client.navigate(client.url) : Promise.resolve(),
        ),
      );
    })(),
  );
});

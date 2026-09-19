export const SW_CLEARED_SESSION_KEY = "gymbrat-sw-cleared-v1";

export type ServiceWorkerLikeRegistration = {
  update: () => Promise<unknown>;
  unregister: () => Promise<boolean>;
};

export type CacheStorageLike = {
  keys: () => Promise<string[]>;
  delete: (key: string) => Promise<boolean>;
};

/**
 * Drops leftover next-pwa / Workbox registrations and Cache Storage entries
 * so production deploys are not hidden behind a stale worker.
 */
export async function clearStaleServiceWorkers(opts: {
  getRegistrations: () => Promise<readonly ServiceWorkerLikeRegistration[]>;
  caches?: CacheStorageLike;
}): Promise<{ registrationCount: number; cacheCount: number }> {
  const registrations = await opts.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      try {
        await registration.update();
      } catch {
        /* update is best-effort — still unregister below */
      }
      await registration.unregister();
    }),
  );

  let cacheCount = 0;
  if (opts.caches) {
    const keys = await opts.caches.keys();
    cacheCount = keys.length;
    await Promise.all(keys.map((key) => opts.caches!.delete(key)));
  }

  return { registrationCount: registrations.length, cacheCount };
}

export function shouldReloadAfterServiceWorkerClear(input: {
  hadController: boolean;
  registrationCount: number;
  cacheCount: number;
  alreadyReloaded: boolean;
}): boolean {
  if (input.alreadyReloaded) return false;
  return input.hadController || input.registrationCount > 0 || input.cacheCount > 0;
}

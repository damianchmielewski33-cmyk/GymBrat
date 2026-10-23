export const SW_CLEARED_SESSION_KEY = "gymbrat-sw-cleared-v1";

export type ServiceWorkerLikeRegistration = {
  update: () => Promise<unknown>;
  unregister: () => Promise<boolean>;
  scriptURL?: string;
  active?: { scriptURL: string } | null;
  waiting?: { scriptURL: string } | null;
  installing?: { scriptURL: string } | null;
};

export type CacheStorageLike = {
  keys: () => Promise<string[]>;
  delete: (key: string) => Promise<boolean>;
};

/** Service worker GymBrat do Web Push — nie wolno go kasować przy starcie. */
export function isGymBratPushScriptUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const path = new URL(url, "https://gymbrat.local").pathname;
    return path === "/sw.js" || path === "/push-sw.js";
  } catch {
    return url.endsWith("/sw.js") || url.endsWith("/push-sw.js");
  }
}

export function isGymBratPushRegistration(reg: ServiceWorkerLikeRegistration): boolean {
  return isGymBratPushScriptUrl(
    reg.scriptURL ??
      reg.active?.scriptURL ??
      reg.waiting?.scriptURL ??
      reg.installing?.scriptURL,
  );
}

/**
 * Usuwa leftover next-pwa / Workbox. Workera `/sw.js` i `/push-sw.js` zostawia —
 * bez nich przypomnienia nie przychodzą przy zamkniętej karcie.
 */
export async function clearStaleServiceWorkers(opts: {
  getRegistrations: () => Promise<readonly ServiceWorkerLikeRegistration[]>;
  caches?: CacheStorageLike;
}): Promise<{ registrationCount: number; cacheCount: number }> {
  const registrations = await opts.getRegistrations();
  let removed = 0;
  await Promise.all(
    registrations.map(async (registration) => {
      const keep = isGymBratPushRegistration(registration);
      try {
        await registration.update();
      } catch {
        /* update is best-effort */
      }
      if (keep) return;
      await registration.unregister();
      removed += 1;
    }),
  );

  let cacheCount = 0;
  if (opts.caches) {
    const keys = await opts.caches.keys();
    cacheCount = keys.length;
    await Promise.all(keys.map((key) => opts.caches!.delete(key)));
  }

  return { registrationCount: removed, cacheCount };
}

export function shouldReloadAfterServiceWorkerClear(input: {
  hadController: boolean;
  registrationCount: number;
  cacheCount: number;
  alreadyReloaded: boolean;
  /** Kontrolujący worker to `/sw.js` lub `/push-sw.js` — nie przeładowuj samej karty. */
  controllerIsPush?: boolean;
}): boolean {
  if (input.alreadyReloaded) return false;
  if (input.controllerIsPush && input.registrationCount === 0 && input.cacheCount === 0) {
    return false;
  }
  return input.hadController || input.registrationCount > 0 || input.cacheCount > 0;
}

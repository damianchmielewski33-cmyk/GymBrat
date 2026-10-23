import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearStaleServiceWorkers,
  isGymBratPushScriptUrl,
  shouldReloadAfterServiceWorkerClear,
} from "@/lib/pwa-update";

describe("clearStaleServiceWorkers", () => {
  it("unregisters workers, attempts an update, and deletes Cache Storage", async () => {
    const deleted: string[] = [];
    const unregistered: string[] = [];
    const updated: string[] = [];

    const result = await clearStaleServiceWorkers({
      getRegistrations: async () => [
        {
          update: async () => {
            updated.push("a");
          },
          unregister: async () => {
            unregistered.push("a");
            return true;
          },
        },
        {
          update: async () => {
            updated.push("b");
          },
          unregister: async () => {
            unregistered.push("b");
            return true;
          },
        },
      ],
      caches: {
        keys: async () => ["workbox-precache-v2-https://gym-brat.vercel.app/", "pages"],
        delete: async (key) => {
          deleted.push(key);
          return true;
        },
      },
    });

    expect(updated).toEqual(["a", "b"]);
    expect(unregistered).toEqual(["a", "b"]);
    expect(deleted).toEqual(["workbox-precache-v2-https://gym-brat.vercel.app/", "pages"]);
    expect(result).toEqual({ registrationCount: 2, cacheCount: 2 });
  });

  it("still unregisters when update() fails", async () => {
    const unregistered: string[] = [];
    const result = await clearStaleServiceWorkers({
      getRegistrations: async () => [
        {
          update: async () => {
            throw new Error("offline");
          },
          unregister: async () => {
            unregistered.push("x");
            return true;
          },
        },
      ],
    });
    expect(unregistered).toEqual(["x"]);
    expect(result).toEqual({ registrationCount: 1, cacheCount: 0 });
  });

  it("does not unregister GymBrat push workers", async () => {
    const unregistered: string[] = [];
    const result = await clearStaleServiceWorkers({
      getRegistrations: async () => [
        {
          scriptURL: "https://gym-brat.vercel.app/push-sw.js",
          update: async () => undefined,
          unregister: async () => {
            unregistered.push("push");
            return true;
          },
        },
        {
          active: { scriptURL: "https://gym-brat.vercel.app/sw.js" },
          update: async () => undefined,
          unregister: async () => {
            unregistered.push("sw");
            return true;
          },
        },
        {
          scriptURL: "https://gym-brat.vercel.app/workbox-abc.js",
          update: async () => undefined,
          unregister: async () => {
            unregistered.push("workbox");
            return true;
          },
        },
      ],
    });
    expect(unregistered).toEqual(["workbox"]);
    expect(result.registrationCount).toBe(1);
  });
});

describe("shouldReloadAfterServiceWorkerClear", () => {
  it("reloads once when a controlling worker or leftover caches existed", () => {
    expect(
      shouldReloadAfterServiceWorkerClear({
        hadController: true,
        registrationCount: 1,
        cacheCount: 0,
        alreadyReloaded: false,
      }),
    ).toBe(true);
    expect(
      shouldReloadAfterServiceWorkerClear({
        hadController: false,
        registrationCount: 0,
        cacheCount: 3,
        alreadyReloaded: false,
      }),
    ).toBe(true);
    expect(
      shouldReloadAfterServiceWorkerClear({
        hadController: true,
        registrationCount: 1,
        cacheCount: 2,
        alreadyReloaded: true,
      }),
    ).toBe(false);
    expect(
      shouldReloadAfterServiceWorkerClear({
        hadController: false,
        registrationCount: 0,
        cacheCount: 0,
        alreadyReloaded: false,
      }),
    ).toBe(false);
  });

  it("does not reload when only the push worker is in control", () => {
    expect(
      shouldReloadAfterServiceWorkerClear({
        hadController: true,
        registrationCount: 0,
        cacheCount: 0,
        alreadyReloaded: false,
        controllerIsPush: true,
      }),
    ).toBe(false);
  });
});

describe("isGymBratPushScriptUrl", () => {
  it("recognizes /sw.js and /push-sw.js", () => {
    expect(isGymBratPushScriptUrl("https://gym-brat.vercel.app/sw.js")).toBe(true);
    expect(isGymBratPushScriptUrl("https://gym-brat.vercel.app/push-sw.js")).toBe(true);
    expect(isGymBratPushScriptUrl("https://gym-brat.vercel.app/workbox-x.js")).toBe(false);
  });
});

describe("public/sw.js push worker", () => {
  it("handles push and does not unregister itself or precache Next assets", () => {
    for (const file of ["sw.js", "push-sw.js"]) {
      const sw = readFileSync(path.join(process.cwd(), "public", file), "utf8");
      expect(sw).toContain("gymbrat-push-");
      expect(sw).toContain("showNotification");
      expect(sw).not.toContain("unregister()");
      expect(sw).not.toMatch(/precacheAndRoute/);
      expect(sw).not.toMatch(/workbox-/);
    }
  });
});

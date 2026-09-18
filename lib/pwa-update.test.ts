import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearStaleServiceWorkers,
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
});

describe("public/sw.js kill-switch", () => {
  it("does not precache hashed Next.js assets from an old build", () => {
    const sw = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain("gymbrat-kill-stale-2026-09-18");
    expect(sw).toContain("unregister()");
    expect(sw).not.toMatch(/precacheAndRoute/);
    expect(sw).not.toMatch(/_next\/static\/Zx6yTKEeoDkApFlxHEFCp/);
    expect(sw).not.toMatch(/workbox-/);
  });
});

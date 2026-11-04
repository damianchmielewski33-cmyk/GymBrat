import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPhotoWithinLimits,
  deleteObject,
  getObjectStorageConfig,
  getObjectText,
  PHOTO_MAX_BYTES,
  presignObjectUrl,
  putObject,
} from "@/lib/object-storage-core";

const env = {
  PHOTO_STORAGE: "s3",
  OBJECT_STORAGE_ENDPOINT: "https://acc.r2.cloudflarestorage.com/",
  OBJECT_STORAGE_BUCKET: "gym",
  OBJECT_STORAGE_ACCESS_KEY_ID: "k",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "s",
} as unknown as NodeJS.ProcessEnv;

function withEnv() {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("magazyn obiektowy (Z39)", () => {
  it("jest wyłączony bez flagi lub kompletu zmiennych", () => {
    expect(getObjectStorageConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      getObjectStorageConfig({ ...env, OBJECT_STORAGE_BUCKET: "" } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(getObjectStorageConfig(env)?.bucket).toBe("gym");
  });

  it("limity rozmiaru i typu", () => {
    expect(() => assertPhotoWithinLimits(PHOTO_MAX_BYTES + 1)).toThrow("photo_too_large");
    expect(() => assertPhotoWithinLimits(10, "image/gif")).toThrow("photo_bad_type");
    expect(() => assertPhotoWithinLimits(10, "image/webp")).not.toThrow();
  });

  it("presign path-style zawiera bucket, klucz i podpis; wygasa najwyżej po 15 min", () => {
    withEnv();
    const url = new URL(presignObjectUrl("PUT", "body-reports/u/r/p", 99999));
    expect(url.pathname).toBe("/gym/body-reports/u/r/p");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("put/get/delete przez fetch; 404 przy get daje null", async () => {
    withEnv();
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        calls.push(init?.method ?? "GET");
        if (init?.method === "PUT") return new Response(null, { status: 200 });
        if (init?.method === "DELETE") return new Response(null, { status: 204 });
        return new Response("x", { status: 404 });
      }),
    );
    await putObject("a/b", "payload", "text/plain");
    expect(await getObjectText("a/b")).toBeNull();
    await deleteObject("a/b");
    expect(calls).toEqual(["PUT", "GET", "DELETE"]);
  });
});

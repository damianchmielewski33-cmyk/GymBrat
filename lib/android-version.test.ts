import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bundledAndroidVersion,
  defaultApkUrl,
  isForeignAndroidArtifactUrl,
  parseAndroidVersionInfo,
  resolveAndroidVersion,
} from "@/lib/android-version";

describe("parseAndroidVersionInfo", () => {
  it("parsuje kompletny obiekt GymBrat", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 4,
        versionName: "0.1.3",
        apkUrl:
          "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/download/android-latest/gymbrat.apk",
        notes: "GymBrat",
      }),
    ).toMatchObject({
      versionCode: 4,
      versionName: "0.1.3",
      notes: "GymBrat",
    });
  });

  it("odrzuca APK Akademii — nie może sterować aktualizacją GymBrat", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 41,
        versionName: "1.11.5",
        apkUrl:
          "https://github.com/damianchmielewski33-cmyk/Akademia-Wielkich-Pi-karzy/releases/download/android-latest/akademia-wp.apk",
      }),
    ).toBeNull();
  });

  it("akceptuje versionCode jako string", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: "4",
      versionName: "0.1.3",
      apkUrl: "https://example.com/gymbrat.apk",
    });
    expect(parsed?.versionCode).toBe(4);
  });

  it("odrzuca brak nazwy wersji", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 1,
        apkUrl: "https://example.com/gymbrat.apk",
      }),
    ).toBeNull();
  });

  it("uzupełnia brakujący apkUrl adresem GymBrat", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: 4,
      versionName: "0.1.3",
    });
    expect(parsed?.apkUrl).toMatch(/GymBrat\/releases\/download\/android-latest\/gymbrat\.apk/i);
  });
});

describe("bundledAndroidVersion", () => {
  it("zwraca wersję GymBrat, nie Akademii", () => {
    const info = bundledAndroidVersion();
    expect(info.versionCode).toBe(6);
    expect(info.versionName).toBe("0.1.5");
    expect(info.apkUrl).toMatch(/gymbrat\.apk/i);
    expect(isForeignAndroidArtifactUrl(info.apkUrl)).toBe(false);
    expect(info.apkUrl.toLowerCase()).not.toContain("akademia");
  });
});

describe("defaultApkUrl", () => {
  it("wskazuje gymbrat.apk z repozytorium GymBrat", () => {
    expect(defaultApkUrl()).toMatch(/GymBrat\/releases\/download\/android-latest\/gymbrat\.apk/i);
    expect(isForeignAndroidArtifactUrl("https://example.com/akademia-wp.apk")).toBe(true);
  });
});

describe("resolveAndroidVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wybiera wyższy versionCode niż stary GitHub Release", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              versionCode: 2,
              versionName: "0.1.1",
              apkUrl:
                "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/download/android-latest/gymbrat.apk",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const info = await resolveAndroidVersion();
    expect(info.versionCode).toBeGreaterThanOrEqual(6);
    expect(info.versionName).toBe("0.1.5");
  });
});

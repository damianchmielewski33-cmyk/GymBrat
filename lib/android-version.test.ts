import { describe, expect, it } from "vitest";
import {
  bundledAndroidVersion,
  isGymBratAndroidAssetUrl,
  parseAndroidVersionInfo,
} from "@/lib/android-version";

describe("parseAndroidVersionInfo", () => {
  it("parsuje kompletny obiekt GymBrat", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 6,
        versionName: "0.1.5",
        apkUrl:
          "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/download/android-latest/gymbrat.apk",
        notes: "test",
      }),
    ).toMatchObject({
      versionCode: 6,
      versionName: "0.1.5",
      notes: "test",
    });
  });

  it("akceptuje versionCode jako string", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: "6",
      versionName: "0.1.5",
      apkUrl: "https://example.com/app.apk",
    });
    expect(parsed?.versionCode).toBe(6);
  });

  it("odrzuca brak nazwy wersji", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 1,
        apkUrl: "https://example.com/app.apk",
      }),
    ).toBeNull();
  });

  it("uzupełnia brakujący apkUrl domyślnym adresem GymBrat", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: 2,
      versionName: "1.0.0",
    });
    expect(parsed?.apkUrl).toMatch(/GymBrat\/releases\/download\/android-latest\/gymbrat\.apk/);
  });
});

describe("isGymBratAndroidAssetUrl", () => {
  it("akceptuje release GymBrat", () => {
    expect(
      isGymBratAndroidAssetUrl(
        "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/download/android-latest/gymbrat.apk",
      ),
    ).toBe(true);
  });

  it("odrzuca APK Akademii", () => {
    expect(
      isGymBratAndroidAssetUrl(
        "https://github.com/damianchmielewski33-cmyk/Akademia-Wielkich-Pi-karzy/releases/download/android-latest/akademia-wp.apk",
      ),
    ).toBe(false);
  });
});

describe("bundledAndroidVersion", () => {
  it("zawsze zwraca poprawny fallback z public/android-version.json GymBrat", () => {
    const info = bundledAndroidVersion();
    expect(info.versionCode).toBe(6);
    expect(info.versionName).toBe("0.1.5");
    expect(info.apkUrl).toMatch(/GymBrat\/releases\/download\/android-latest\/gymbrat\.apk/);
  });
});

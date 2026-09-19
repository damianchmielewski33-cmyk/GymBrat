import { describe, expect, it } from "vitest";
import {
  bundledAndroidVersion,
  parseAndroidVersionInfo,
} from "@/lib/android-version";

describe("parseAndroidVersionInfo", () => {
  it("parsuje kompletny obiekt", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 41,
        versionName: "1.11.5",
        apkUrl:
          "https://github.com/damianchmielewski33-cmyk/GymBrat/releases/latest/download/gymbrat.apk",
        notes: "fix",
      }),
    ).toMatchObject({
      versionCode: 41,
      versionName: "1.11.5",
      notes: "fix",
    });
  });

  it("akceptuje versionCode jako string", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: "41",
      versionName: "1.11.5",
      apkUrl: "https://example.com/app.apk",
    });
    expect(parsed?.versionCode).toBe(41);
  });

  it("odrzuca brak nazwy wersji", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 1,
        apkUrl: "https://example.com/app.apk",
      }),
    ).toBeNull();
  });

  it("uzupełnia brakujący apkUrl domyślnym adresem", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: 2,
      versionName: "1.0.0",
    });
    expect(parsed?.apkUrl).toMatch(/^https:\/\//);
  });
});

describe("bundledAndroidVersion", () => {
  it("zawsze zwraca poprawny fallback z public/android-version.json", () => {
    const info = bundledAndroidVersion();
    expect(info.versionCode).toBeGreaterThan(0);
    expect(info.versionName.length).toBeGreaterThan(0);
    expect(info.apkUrl).toMatch(/^https:\/\//);
  });
});

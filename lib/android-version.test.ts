import { describe, expect, it } from "vitest";
import {
  bundledAndroidVersion,
  parseAndroidVersionInfo,
} from "@/lib/android-version";

describe("parseAndroidVersionInfo", () => {
  it("parsuje kompletny obiekt GymBrat", () => {
    expect(
      parseAndroidVersionInfo({
        versionCode: 1,
        versionName: "0.1.0",
        apkUrl: "https://gym-brat.vercel.app/gymbrat.apk",
        notes: "GymBrat",
      }),
    ).toMatchObject({
      versionCode: 1,
      versionName: "0.1.0",
      notes: "GymBrat",
    });
  });

  it("akceptuje versionCode jako string", () => {
    const parsed = parseAndroidVersionInfo({
      versionCode: "2",
      versionName: "0.1.1",
      apkUrl: "https://example.com/gymbrat.apk",
    });
    expect(parsed?.versionCode).toBe(2);
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
    expect(parsed?.apkUrl).toMatch(/gymbrat\.apk|gym-brat/);
  });
});

describe("bundledAndroidVersion", () => {
  it("zawsze zwraca poprawny fallback GymBrat z public/android-version.json", () => {
    const info = bundledAndroidVersion();
    expect(info.versionCode).toBe(1);
    expect(info.versionName).toBe("0.1.0");
    expect(info.apkUrl).toMatch(/gymbrat\.apk/);
    expect(info.apkUrl).not.toMatch(/Akademia|akademia-wp/i);
  });
});

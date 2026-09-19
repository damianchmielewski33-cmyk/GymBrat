import { describe, expect, it } from "vitest";
import {
  androidUpdateLaterStorageKey,
  compareAndroidAppVersion,
  compareVersionName,
  isAppWebViewUserAgent,
  parseAndroidAppIdentity,
  shouldShowAndroidUpdatePrompt,
} from "@/lib/app-webview";

describe("app-webview", () => {
  it("rozpoznaje WebView aplikacji AWP i GymBrat", () => {
    expect(isAppWebViewUserAgent("Mozilla/5.0 AWPAndroidApp/1.10.3")).toBe(true);
    expect(isAppWebViewUserAgent("Mozilla/5.0 GymBratAndroidApp/0.1.0")).toBe(true);
    expect(isAppWebViewUserAgent("Mozilla/5.0")).toBe(false);
  });

  it("czyta wersję i numer kompilacji z User-Agenta", () => {
    expect(parseAndroidAppIdentity("Foo AWPAndroidApp/1.10.3 AWPAndroidCode/26 Bar")).toEqual({
      versionName: "1.10.3",
      versionCode: 26,
    });
    expect(parseAndroidAppIdentity("GymBratAndroidApp/0.1.0 GymBratAndroidCode/3")).toEqual({
      versionName: "0.1.0",
      versionCode: 3,
    });
    expect(parseAndroidAppIdentity("AWPAndroidApp/1.9.0")).toEqual({
      versionName: "1.9.0",
      versionCode: null,
    });
    expect(parseAndroidAppIdentity("Chrome Mobile")).toBeNull();
  });

  it("porównuje wersje po kodzie albo nazwie", () => {
    expect(compareVersionName("1.11.0", "1.10.3")).toBeGreaterThan(0);
    expect(compareVersionName("1.10.3", "1.10.3")).toBe(0);
    expect(
      compareAndroidAppVersion(
        { versionName: "1.10.3", versionCode: 26 },
        { versionName: "1.11.0", versionCode: 27 },
      ),
    ).toBeGreaterThan(0);
    expect(
      compareAndroidAppVersion(
        { versionName: "1.10.3", versionCode: 26 },
        { versionName: "1.10.3", versionCode: 26 },
      ),
    ).toBe(0);
  });

  it("pokazuje popup tylko w zainstalowanej aplikacji, gdy jest nowsza wersja", () => {
    const current = { versionName: "1.10.3", versionCode: 26 };
    const latest = { versionName: "1.11.0", versionCode: 27 };
    expect(shouldShowAndroidUpdatePrompt({ inInstalledApp: true, current, latest })).toBe(true);
    expect(shouldShowAndroidUpdatePrompt({ inInstalledApp: false, current, latest })).toBe(false);
    expect(
      shouldShowAndroidUpdatePrompt({
        inInstalledApp: true,
        current,
        latest: { versionName: "1.10.3", versionCode: 26 },
      }),
    ).toBe(false);
    expect(
      shouldShowAndroidUpdatePrompt({
        inInstalledApp: true,
        current,
        latest,
        postponedVersionCode: 27,
      }),
    ).toBe(false);
    expect(androidUpdateLaterStorageKey(27)).toBe("gymbrat-android-update-later:27");
  });
});

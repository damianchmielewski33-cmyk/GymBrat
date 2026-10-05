import { afterEach, describe, expect, it, vi } from "vitest";
import {
  androidUpdateLaterStorageKey,
  compareAndroidAppVersion,
  compareVersionName,
  ensureAndroidCameraPermission,
  isAndroidPhoneBrowserUserAgent,
  isAppWebViewUserAgent,
  parseAndroidAppIdentity,
  shouldShowAndroidUpdatePrompt,
  stableAndroidIdentity,
} from "@/lib/app-webview";

describe("app-webview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rozpoznaje WebView aplikacji AWP i GymBrat", () => {
    expect(isAppWebViewUserAgent("Mozilla/5.0 AWPAndroidApp/1.10.3")).toBe(true);
    expect(isAppWebViewUserAgent("Mozilla/5.0 GymBratAndroidApp/0.1.0")).toBe(true);
    expect(isAppWebViewUserAgent("Mozilla/5.0")).toBe(false);
  });

  it("rozpoznaje przeglądarkę na telefonie Android (nie desktop, nie APK)", () => {
    expect(
      isAndroidPhoneBrowserUserAgent(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(true);
    expect(
      isAndroidPhoneBrowserUserAgent(
        "Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isAndroidPhoneBrowserUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      ),
    ).toBe(false);
    expect(
      isAndroidPhoneBrowserUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isAndroidPhoneBrowserUserAgent("Mozilla/5.0 GymBratAndroidApp/0.1.11 GymBratAndroidCode/12"),
    ).toBe(false);
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
    expect(
      shouldShowAndroidUpdatePrompt({
        inInstalledApp: true,
        current,
        latest,
        signedIn: false,
      }),
    ).toBe(false);
    expect(
      shouldShowAndroidUpdatePrompt({
        inInstalledApp: true,
        current,
        latest,
        signedIn: true,
      }),
    ).toBe(true);
  });

  it("zwraca tę samą referencję tożsamości APK, gdy wersja się nie zmieniła", () => {
    const first = { versionName: "0.1.0", versionCode: 1 };
    const second = { versionName: "0.1.0", versionCode: 1 };
    expect(stableAndroidIdentity(first, null)).toBe(first);
    expect(stableAndroidIdentity(second, first)).toBe(first);
    expect(stableAndroidIdentity(null, first)).toBeNull();
    const newer = { versionName: "0.1.1", versionCode: 2 };
    expect(stableAndroidIdentity(newer, first)).toBe(newer);
  });

  it("ensureAndroidCameraPermission prosi most APK o dialog CAMERA", async () => {
    const requestCameraPermission = vi.fn(() => {
      queueMicrotask(() => window.__gymbratOnCameraPermission?.(true));
    });
    vi.stubGlobal("window", {
      GymBratAndroid: {
        getVersionName: () => "0.1.5",
        getVersionCode: () => 6,
        checkUpdate: () => {},
        hasCameraPermission: () => false,
        requestCameraPermission,
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      __gymbratOnCameraPermission: undefined as ((g: boolean) => void) | undefined,
    });

    await expect(ensureAndroidCameraPermission()).resolves.toBe(true);
    expect(requestCameraPermission).toHaveBeenCalledOnce();
  });

  it("ensureAndroidCameraPermission pomija dialog, gdy CAMERA już jest", async () => {
    const requestCameraPermission = vi.fn();
    vi.stubGlobal("window", {
      GymBratAndroid: {
        getVersionName: () => "0.1.5",
        getVersionCode: () => 6,
        checkUpdate: () => {},
        hasCameraPermission: () => true,
        requestCameraPermission,
      },
    });
    await expect(ensureAndroidCameraPermission()).resolves.toBe(true);
    expect(requestCameraPermission).not.toHaveBeenCalled();
  });
});

/**
 * WebView aplikacji Android (Akademia Wielkich Piłkarzy) dokleja ten token do User-Agenta.
 * GymBrat jest otwierany z tej samej APK — rozpoznajemy ją, żeby pokazać kartę aktualizacji
 * i nie mylić zwykłej przeglądarki / PWA z zainstalowaną aplikacją.
 */
const APP_WEBVIEW_UA_MARKERS = ["AWPAndroidApp", "GymBratAndroidApp"] as const;
const APP_WEBVIEW_VERSION_RE = /(?:AWPAndroidApp|GymBratAndroidApp)\/([^\s]+)/;
const APP_WEBVIEW_CODE_RE = /(?:AWPAndroidCode|GymBratAndroidCode)\/(\d+)/;

export const ANDROID_UPDATE_LATER_STORAGE_PREFIX = "gymbrat-android-update-later:";

declare global {
  interface Window {
    AwpAndroid?: {
      getVersionName: () => string;
      getVersionCode: () => number;
      checkUpdate: () => void;
      openExternalUrl?: (url: string) => void;
      vibrate?: (patternCsv: string) => void;
      notifyContentReady?: () => void;
    };
    GymBratAndroid?: {
      getVersionName: () => string;
      getVersionCode: () => number;
      checkUpdate: () => void;
    };
  }
}

export function isAppWebViewUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return APP_WEBVIEW_UA_MARKERS.some((marker) => ua.includes(marker));
}

export function isRunningInAppWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return isAppWebViewUserAgent(navigator.userAgent);
}

/** Zainstalowany APK: most JS albo User-Agent WebView. Zwykła przeglądarka / PWA — nie. */
export function isInstalledAndroidAppClient(): boolean {
  if (typeof window === "undefined") return false;
  if (window.AwpAndroid || window.GymBratAndroid) return true;
  return isRunningInAppWebView();
}

export type AndroidAppIdentity = {
  versionName: string;
  versionCode: number | null;
};

export type AndroidLatestVersion = {
  versionName: string;
  versionCode: number;
};

function readBridgeIdentity(): AndroidAppIdentity | null {
  if (typeof window === "undefined") return null;
  const bridges = [window.GymBratAndroid, window.AwpAndroid];
  for (const bridge of bridges) {
    if (!bridge) continue;
    try {
      const versionName = String(bridge.getVersionName?.() ?? "").trim();
      const versionCode = Number(bridge.getVersionCode?.());
      if (versionName) {
        return {
          versionName,
          versionCode: Number.isFinite(versionCode) ? versionCode : null,
        };
      }
    } catch {
      /* most niedostępny */
    }
  }
  return null;
}

export function readInstalledAndroidAppIdentity(): AndroidAppIdentity | null {
  const fromBridge = readBridgeIdentity();
  if (fromBridge) return fromBridge;
  return parseAndroidAppIdentity(typeof navigator === "undefined" ? "" : navigator.userAgent);
}

export function parseAndroidAppIdentity(ua: string | null | undefined): AndroidAppIdentity | null {
  if (!isAppWebViewUserAgent(ua)) return null;
  const name = ua?.match(APP_WEBVIEW_VERSION_RE)?.[1]?.trim();
  if (!name) return { versionName: "nieznana", versionCode: null };
  const codeRaw = ua?.match(APP_WEBVIEW_CODE_RE)?.[1];
  const versionCode = codeRaw ? Number(codeRaw) : null;
  return {
    versionName: name,
    versionCode: Number.isFinite(versionCode) ? versionCode : null,
  };
}

/** Dodatnie, gdy `latest` jest nowsza od `current`. */
export function compareAndroidAppVersion(
  current: AndroidAppIdentity,
  latest: AndroidLatestVersion,
): number {
  if (current.versionCode != null && Number.isFinite(current.versionCode)) {
    return latest.versionCode - current.versionCode;
  }
  return compareVersionName(latest.versionName, current.versionName);
}

export function compareVersionName(a: string, b: string): number {
  const pa = a.split(/[^\d]+/).map((x) => Number(x)).filter((n) => Number.isFinite(n));
  const pb = b.split(/[^\d]+/).map((x) => Number(x)).filter((n) => Number.isFinite(n));
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function androidUpdateLaterStorageKey(versionCode: number): string {
  return `${ANDROID_UPDATE_LATER_STORAGE_PREFIX}${versionCode}`;
}

/** Popup tylko w zainstalowanym APK, gdy serwer ma nowszą kompilację. */
export function shouldShowAndroidUpdatePrompt(args: {
  inInstalledApp: boolean;
  current: AndroidAppIdentity | null;
  latest: AndroidLatestVersion | null;
  postponedVersionCode?: number | null;
}): boolean {
  if (!args.inInstalledApp || !args.current || !args.latest) return false;
  if (compareAndroidAppVersion(args.current, args.latest) <= 0) return false;
  if (args.postponedVersionCode === args.latest.versionCode) return false;
  return true;
}

export function requestNativeAndroidUpdate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.GymBratAndroid?.checkUpdate) {
      window.GymBratAndroid.checkUpdate();
      return true;
    }
    if (window.AwpAndroid?.checkUpdate) {
      window.AwpAndroid.checkUpdate();
      return true;
    }
  } catch {
    /* most niedostępny */
  }
  return false;
}

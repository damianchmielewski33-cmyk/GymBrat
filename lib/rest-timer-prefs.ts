const KEY_AUTO = "gymbrat:restAutoStart";
const KEY_SEC = "gymbrat:restDefaultSeconds";

export function readRestTimerPrefs(): { autoStart: boolean; defaultSeconds: number } {
  if (typeof window === "undefined") {
    return { autoStart: true, defaultSeconds: 90 };
  }
  const autoStart = window.localStorage.getItem(KEY_AUTO) !== "0";
  const raw = window.localStorage.getItem(KEY_SEC);
  const n = raw != null ? Number.parseInt(raw, 10) : 90;
  const defaultSeconds = Number.isFinite(n)
    ? Math.min(600, Math.max(15, Math.round(n)))
    : 90;
  return { autoStart, defaultSeconds };
}

export function writeRestAutoStart(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_AUTO, enabled ? "1" : "0");
}

export function writeRestDefaultSeconds(seconds: number) {
  if (typeof window === "undefined") return;
  const s = Math.min(600, Math.max(15, Math.round(seconds)));
  window.localStorage.setItem(KEY_SEC, String(s));
}

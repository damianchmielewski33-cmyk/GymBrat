const KEY = "gymbrat:exerciseRestSeconds";
const MUTE_KEY = "gymbrat:restMuted";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v);
      if (k && Number.isFinite(n)) out[k] = Math.min(600, Math.max(15, Math.round(n)));
    }
    return out;
  } catch {
    return {};
  }
}

export function readExerciseRestSeconds(exerciseId: string): number | null {
  const n = readMap()[exerciseId];
  return typeof n === "number" ? n : null;
}

export function writeExerciseRestSeconds(exerciseId: string, seconds: number) {
  if (typeof window === "undefined") return;
  const map = readMap();
  map[exerciseId] = Math.min(600, Math.max(15, Math.round(seconds)));
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function clearExerciseRestSeconds(exerciseId: string) {
  if (typeof window === "undefined") return;
  const map = readMap();
  delete map[exerciseId];
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function isRestMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function writeRestMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

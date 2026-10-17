/**
 * Sygnał odpoczynku między seriami (Web Audio).
 * Przeglądarki wymagają „unlock” po geście użytkownika — inaczej dźwięk jest wyciszony.
 *
 * — start przerwy: krótki chirp
 * — końcówka (3–1 s): dźwięk kończącego się czasu
 * — 0 s: gong
 */

import { hapticRestEnd } from "@/lib/haptics";

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AC();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Wywołaj przy Zalicz serię / otwarciu przerwy — odblokowuje audio na iOS/Android/Chrome. */
export async function unlockRestTimerAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    // Ciche „ping” 1 ms — utrwala unlock po geście.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.00001;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.001);
  } catch {
    /* ignore */
  }
}

function beep(
  ctx: AudioContext,
  at: number,
  freq: number,
  duration: number,
  peak = 0.18,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/**
 * Dźwięk kończącego się czasu (ostatnie 3–1 s przerwy).
 * Krótki, wyraźny tick — inny od gongu na 0.
 */
export function playRestTimerEndingSignal(secondsLeft?: number) {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  void (async () => {
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const t0 = ctx.currentTime;
      // Im bliżej zera, tym wyższy ton (3→880, 2→990, 1→1175).
      const left = Math.max(1, Math.min(3, Math.round(secondsLeft ?? 2)));
      const freq = left === 3 ? 880 : left === 2 ? 990 : 1175;
      beep(ctx, t0, freq, 0.11, 0.2, "triangle");
    } catch {
      /* ignore */
    }
  })();
}

/**
 * Gong na koniec przerwy + wibracja.
 * Długi, metaliczny uderzeniowy ton (nie podwójny beep).
 */
export function playRestTimerEndSignal() {
  if (typeof window === "undefined") return;

  const ctx = getAudioContext();
  void (async () => {
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const t0 = ctx.currentTime;
      const duration = 1.35;
      // Fundament + alikwoty jak przy gongu / talerzu.
      const partials: { freq: number; peak: number; type: OscillatorType }[] = [
        { freq: 110, peak: 0.28, type: "sine" },
        { freq: 165, peak: 0.14, type: "sine" },
        { freq: 220, peak: 0.1, type: "triangle" },
        { freq: 330, peak: 0.06, type: "sine" },
        { freq: 440, peak: 0.04, type: "triangle" },
      ];
      for (const p of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = p.type;
        osc.frequency.setValueAtTime(p.freq, t0);
        // Lekkie zejście częstotliwości jak przy uderzeniu w metal.
        osc.frequency.exponentialRampToValueAtTime(p.freq * 0.92, t0 + duration);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(p.peak, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.start(t0);
        osc.stop(t0 + duration + 0.05);
      }
    } catch {
      /* ignore */
    }
  })();

  hapticRestEnd();
}

/** Krótki chirp na start przerwy (między seriami). */
export function playRestTimerStartSignal() {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  void (async () => {
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      beep(ctx, ctx.currentTime, 660, 0.1, 0.12);
    } catch {
      /* ignore */
    }
  })();
}

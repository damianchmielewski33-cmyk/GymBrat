/**
 * Sygnał odpoczynku między seriami (Web Audio).
 * Przeglądarki wymagają „unlock” po geście użytkownika — inaczej dźwięk jest wyciszony.
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
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/**
 * Podwójny sygnał końca przerwy + wibracja.
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
      beep(ctx, t0, 880, 0.16, 0.2);
      beep(ctx, t0 + 0.22, 1175, 0.22, 0.22);
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

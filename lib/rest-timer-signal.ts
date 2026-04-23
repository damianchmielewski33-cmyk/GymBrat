/**
 * Krótki sygnał końca odpoczynku: Web Audio + fallback wibracja.
 */
export function playRestTimerEndSignal() {
  if (typeof window === "undefined") return;

  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // ignore
  }

  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([120, 40, 120]);
    }
  } catch {
    // ignore
  }
}

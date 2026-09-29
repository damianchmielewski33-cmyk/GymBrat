/**
 * Flaga: czy ActiveWorkoutCloudSync skończył pierwszy pull z chmury.
 * Route gate na /active-workout czeka na to, żeby nie wyrzucić sesji z innego urządzenia.
 */

let cloudHydrated = false;
const waiters = new Set<() => void>();

export function isActiveWorkoutCloudHydrated(): boolean {
  return cloudHydrated;
}

export function markActiveWorkoutCloudHydrated(): void {
  if (cloudHydrated) return;
  cloudHydrated = true;
  for (const w of waiters) w();
  waiters.clear();
}

/** Resolves when cloud sync hydrates, or after `timeoutMs` (offline / błąd sieci). */
export function whenActiveWorkoutCloudHydrated(timeoutMs = 2500): Promise<void> {
  if (cloudHydrated) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      waiters.delete(done);
      window.clearTimeout(timer);
      resolve();
    };
    waiters.add(done);
    const timer = window.setTimeout(() => {
      // Timeout: nie blokuj UI w nieskończoność, ale nie oznaczaj globalnie
      // jako hydrated — sync może jeszcze wrócić.
      waiters.delete(done);
      resolve();
    }, timeoutMs);
  });
}

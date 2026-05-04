/**
 * Logika dostępności AI bez I/O — używana w testach i w `lib/ai-availability.ts`.
 */
export function computeAiEnabledForUser(flags: {
  isConfigured: boolean;
  globalDisabled: boolean;
  entitled: boolean;
  userDisabled: boolean;
}): boolean {
  if (!flags.isConfigured) return false;
  if (flags.globalDisabled) return false;
  if (!flags.entitled) return false;
  if (flags.userDisabled) return false;
  return true;
}

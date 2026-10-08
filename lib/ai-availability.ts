import "server-only";

import { getAppSettings } from "@/lib/app-settings";
import { computeAiEnabledForUser } from "@/lib/ai-availability-logic";
import {
  getUserAiEntitled,
  getUserAiFeaturesDisabled,
} from "@/lib/user-ai-preference";

/** Wbudowany LLM usunięty — zawsze false. */
export async function isAiEnabledForUser(userId: string): Promise<boolean> {
  const settings = await getAppSettings();
  return computeAiEnabledForUser({
    isConfigured: false,
    globalDisabled: settings.aiGloballyDisabled,
    entitled: await getUserAiEntitled(userId),
    userDisabled: await getUserAiFeaturesDisabled(userId),
  });
}

export async function isAiGloballyDisabled(): Promise<boolean> {
  const s = await getAppSettings();
  return s.aiGloballyDisabled;
}

import "server-only";

import { isAiConfigured } from "@/ai/client";
import { computeAiEnabledForUser } from "@/lib/ai-availability-logic";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { getAppSettings } from "@/lib/app-settings";

export async function isAiEnabledForUser(userId: string): Promise<boolean> {
  const [settings, entitled, userOff] = await Promise.all([
    getAppSettings(),
    getUserAiEntitled(userId),
    getUserAiFeaturesDisabled(userId),
  ]);
  return computeAiEnabledForUser({
    isConfigured: isAiConfigured(),
    globalDisabled: settings.aiGloballyDisabled,
    entitled,
    userDisabled: userOff,
  });
}

export async function isAiGloballyDisabled(): Promise<boolean> {
  const s = await getAppSettings();
  return s.aiGloballyDisabled;
}


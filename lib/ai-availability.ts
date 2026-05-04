import "server-only";

import { isAiConfigured } from "@/ai/client";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { getAppSettings } from "@/lib/app-settings";

export async function isAiEnabledForUser(userId: string): Promise<boolean> {
  if (!isAiConfigured()) return false;
  const [settings, entitled, userOff] = await Promise.all([
    getAppSettings(),
    getUserAiEntitled(userId),
    getUserAiFeaturesDisabled(userId),
  ]);
  if (settings.aiGloballyDisabled) return false;
  if (!entitled) return false;
  if (userOff) return false;
  return true;
}

export async function isAiGloballyDisabled(): Promise<boolean> {
  const s = await getAppSettings();
  return s.aiGloballyDisabled;
}


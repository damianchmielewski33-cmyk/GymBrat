"use server";

import { auth } from "@/auth";
import { searchDiscoverableUsers } from "@/lib/community/discover";
import { followUser, unfollowUser } from "@/lib/community/follows";
import {
  updateSocialProfile,
  type ProfileVisibility,
} from "@/lib/community/social-profile";

export async function searchUsersAction(query: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return [];
  return searchDiscoverableUsers(query, userId);
}

export async function followAction(targetUserId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Zaloguj się." };
  return followUser(userId, targetUserId);
}

export async function unfollowAction(targetUserId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await unfollowUser(userId, targetUserId);
}

export async function updatePrivacyAction(input: {
  visibility?: ProfileVisibility;
  bio?: string | null;
  showStats?: boolean;
  showOnGlobal?: boolean;
  discoverable?: boolean;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Zaloguj się." };
  await updateSocialProfile(userId, input);
  return { ok: true as const };
}

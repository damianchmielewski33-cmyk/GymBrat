"use server";

import { guardAction } from "@/lib/action-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import {
  acceptFriendship,
  declineFriendship,
  removeFriendship,
  requestFriendshipByEmail,
  requestFriendshipFromTeamMember,
  setShareWorkout,
} from "@/lib/community/friendships";
import { UserMessages } from "@/lib/user-facing-errors";

export type FriendshipActionState = {
  ok?: boolean;
  error?: string;
  friendshipId?: string;
};

function revalidateFriendPaths(userId?: string) {
  revalidatePath("/community/friends");
  if (userId) {
    revalidatePath(`/community/friends/${userId}/live`);
  }
  revalidatePath("/community/teams");
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }
  return { ok: true as const, userId: session.user.id };
}

export async function requestFriendshipByEmailAction(
  _prev: FriendshipActionState,
  formData: FormData,
): Promise<FriendshipActionState> {
  await guardAction("friendships.requestFriendshipByEmailAction", { limit: 20, windowMs: 3600000 });
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const email = String(formData.get("email") ?? "").trim();
  if (!email || email.length > 200) {
    return { error: "Podaj poprawny e-mail." };
  }

  const result = await requestFriendshipByEmail(user.userId, email);
  if (!result.ok) return { error: result.error };
  revalidateFriendPaths();
  return { ok: true, friendshipId: result.friendshipId };
}

export async function requestFriendshipFromTeamAction(
  _prev: FriendshipActionState,
  formData: FormData,
): Promise<FriendshipActionState> {
  await guardAction("friendships.requestFriendshipFromTeamAction");
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const otherUserId = String(formData.get("otherUserId") ?? "").trim();
  if (!otherUserId) return { error: "Brak użytkownika." };

  const result = await requestFriendshipFromTeamMember(
    user.userId,
    otherUserId,
  );
  if (!result.ok) return { error: result.error };
  revalidateFriendPaths(otherUserId);
  return { ok: true, friendshipId: result.friendshipId };
}

export async function acceptFriendshipAction(
  _prev: FriendshipActionState,
  formData: FormData,
): Promise<FriendshipActionState> {
  await guardAction("friendships.acceptFriendshipAction");
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  if (!friendshipId) return { error: "Brak zaproszenia." };

  const result = await acceptFriendship(user.userId, friendshipId);
  if (!result.ok) return { error: result.error };
  revalidateFriendPaths();
  return { ok: true };
}

export async function declineFriendshipAction(
  _prev: FriendshipActionState,
  formData: FormData,
): Promise<FriendshipActionState> {
  await guardAction("friendships.declineFriendshipAction");
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  if (!friendshipId) return { error: "Brak zaproszenia." };

  const result = await declineFriendship(user.userId, friendshipId);
  if (!result.ok) return { error: result.error };
  revalidateFriendPaths();
  return { ok: true };
}

export async function removeFriendshipAction(
  _prev: FriendshipActionState,
  formData: FormData,
): Promise<FriendshipActionState> {
  await guardAction("friendships.removeFriendshipAction");
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const friendshipId = String(formData.get("friendshipId") ?? "").trim();
  if (!friendshipId) return { error: "Brak znajomości." };

  const result = await removeFriendship(user.userId, friendshipId);
  if (!result.ok) return { error: result.error };
  revalidateFriendPaths();
  return { ok: true };
}

const shareSchema = z.object({
  friendshipId: z.string().min(1),
  enabled: z.enum(["0", "1", "true", "false"]),
});

export async function setShareWorkoutAction(
  _prev: FriendshipActionState,
  formData: FormData,
): Promise<FriendshipActionState> {
  await guardAction("friendships.setShareWorkoutAction");
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const parsed = shareSchema.safeParse({
    friendshipId: formData.get("friendshipId"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return { error: "Nieprawidłowe dane." };

  const enabled =
    parsed.data.enabled === "1" || parsed.data.enabled === "true";
  const result = await setShareWorkout(
    user.userId,
    parsed.data.friendshipId,
    enabled,
  );
  if (!result.ok) return { error: result.error };
  revalidateFriendPaths();
  return { ok: true };
}

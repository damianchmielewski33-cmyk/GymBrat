"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  addTeamPostComment,
  createTeamPost,
  deleteTeamPost,
  setTeamPostReaction,
} from "@/lib/community/team-feed";
import { isFeedReactionKind } from "@/lib/community/feed-reactions";
import { UserMessages } from "@/lib/user-facing-errors";

export type TeamFeedActionState = {
  ok?: boolean;
  error?: string;
  postId?: string;
  commentId?: string;
};

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }
  return { ok: true as const, userId: session.user.id };
}

function revalidateTeamFeed(teamId: string) {
  revalidatePath(`/community/teams/${teamId}`);
  revalidatePath("/community/teams");
}

export async function createTeamFeedPostAction(
  _prev: TeamFeedActionState,
  formData: FormData,
): Promise<TeamFeedActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const teamId = String(formData.get("teamId") ?? "");
  const body = String(formData.get("body") ?? "");
  const imagesRaw = String(formData.get("imagesJson") ?? "[]");
  let images: Array<{ mimeType: string; dataUrl: string }> = [];
  try {
    const parsed = JSON.parse(imagesRaw) as unknown;
    if (Array.isArray(parsed)) {
      images = parsed
        .filter(
          (x): x is { mimeType: string; dataUrl: string } =>
            !!x &&
            typeof x === "object" &&
            typeof (x as { dataUrl?: unknown }).dataUrl === "string",
        )
        .map((x) => ({
          mimeType:
            typeof x.mimeType === "string" ? x.mimeType : "image/jpeg",
          dataUrl: x.dataUrl,
        }));
    }
  } catch {
    return { error: "Nie udało się odczytać zdjęć." };
  }

  const result = await createTeamPost({
    teamId,
    authorUserId: user.userId,
    type: images.length > 0 ? "gallery" : "text",
    body,
    images,
  });
  if (!result.ok) return { error: result.error };
  revalidateTeamFeed(teamId);
  return { ok: true, postId: result.postId };
}

export async function addTeamFeedCommentAction(
  _prev: TeamFeedActionState,
  formData: FormData,
): Promise<TeamFeedActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const teamId = String(formData.get("teamId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "");
  const parentCommentId = String(formData.get("parentCommentId") ?? "") || null;

  const result = await addTeamPostComment({
    teamId,
    postId,
    authorUserId: user.userId,
    body,
    parentCommentId,
  });
  if (!result.ok) return { error: result.error };
  revalidateTeamFeed(teamId);
  return { ok: true, commentId: result.commentId };
}

export async function setTeamFeedReactionAction(
  _prev: TeamFeedActionState,
  formData: FormData,
): Promise<TeamFeedActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const teamId = String(formData.get("teamId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const kind = isFeedReactionKind(kindRaw) ? kindRaw : null;

  const result = await setTeamPostReaction({
    teamId,
    postId,
    userId: user.userId,
    kind,
  });
  if (!result.ok) return { error: result.error };
  revalidateTeamFeed(teamId);
  return { ok: true };
}

export async function deleteTeamFeedPostAction(
  _prev: TeamFeedActionState,
  formData: FormData,
): Promise<TeamFeedActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const teamId = String(formData.get("teamId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const result = await deleteTeamPost({
    teamId,
    postId,
    userId: user.userId,
  });
  if (!result.ok) return { error: result.error };
  revalidateTeamFeed(teamId);
  return { ok: true };
}

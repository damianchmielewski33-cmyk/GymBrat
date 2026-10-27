"use server";

import { guardAction } from "@/lib/action-guard";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { userExerciseNotes } from "@/db/schema";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";
import { UserMessages } from "@/lib/user-facing-errors";

const NOTE_MAX = 300;
const URL_MAX = 500;

export type UserExerciseNoteDTO = {
  exerciseId: string;
  personalYoutubeUrl: string | null;
  note: string | null;
  updatedAt: string;
};

export async function getUserExerciseNote(
  exerciseId: string,
): Promise<UserExerciseNoteDTO | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = exerciseId.trim();
  if (!id) return null;

  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(userExerciseNotes)
    .where(
      and(
        eq(userExerciseNotes.userId, session.user.id),
        eq(userExerciseNotes.exerciseId, id),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    exerciseId: row.exerciseId,
    personalYoutubeUrl: row.personalYoutubeUrl,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveUserExerciseNote(input: {
  exerciseId: string;
  personalYoutubeUrl?: string | null;
  note?: string | null;
}): Promise<{ ok: true; note: UserExerciseNoteDTO } | { ok: false; error: string }> {
  await guardAction("user-exercise-notes.saveUserExerciseNote", {
    limit: 60,
    windowMs: 60_000,
  });
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: UserMessages.sessionExpired };
  }

  const exerciseId = input.exerciseId.trim();
  if (!exerciseId) {
    return { ok: false, error: "Brak identyfikatora ćwiczenia." };
  }

  let personalYoutubeUrl: string | null = null;
  if (input.personalYoutubeUrl != null && String(input.personalYoutubeUrl).trim()) {
    const raw = String(input.personalYoutubeUrl).trim().slice(0, URL_MAX);
    const yt = normalizeYoutubeUrl(raw);
    personalYoutubeUrl = yt ?? (raw.startsWith("https://") ? raw : null);
    if (!personalYoutubeUrl) {
      return {
        ok: false,
        error: "To nie wygląda na link. Wpisz adres zaczynający się od https://.",
      };
    }
  }

  const note =
    input.note != null && String(input.note).trim()
      ? String(input.note).trim().slice(0, NOTE_MAX)
      : null;

  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select({ id: userExerciseNotes.id })
    .from(userExerciseNotes)
    .where(
      and(
        eq(userExerciseNotes.userId, session.user.id),
        eq(userExerciseNotes.exerciseId, exerciseId),
      ),
    )
    .limit(1);

  if (!personalYoutubeUrl && !note) {
    if (existing) {
      await db
        .delete(userExerciseNotes)
        .where(eq(userExerciseNotes.id, existing.id));
    }
    return {
      ok: true,
      note: {
        exerciseId,
        personalYoutubeUrl: null,
        note: null,
        updatedAt: now.toISOString(),
      },
    };
  }

  if (existing) {
    await db
      .update(userExerciseNotes)
      .set({ personalYoutubeUrl, note, updatedAt: now })
      .where(eq(userExerciseNotes.id, existing.id));
  } else {
    await db.insert(userExerciseNotes).values({
      userId: session.user.id,
      exerciseId,
      personalYoutubeUrl,
      note,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    ok: true,
    note: {
      exerciseId,
      personalYoutubeUrl,
      note,
      updatedAt: now.toISOString(),
    },
  };
}

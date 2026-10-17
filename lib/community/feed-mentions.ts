import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teamMembers, users } from "@/db/schema";

export type MentionCandidate = {
  userId: string;
  displayName: string;
  handle: string;
};

function displayName(row: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}): string {
  const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  if (full) return full;
  if (row.name?.trim()) return row.name.trim();
  return row.email.split("@")[0] || "Zawodnik";
}

function handleFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]+/g, "")
    .slice(0, 32);
}

/** Wyciąga @tokeny z tekstu (bez spacji). */
export function extractMentionTokens(text: string): string[] {
  const matches = text.match(/@([A-Za-zÀ-ž0-9_]{2,40})/g) ?? [];
  const set = new Set(
    matches.map((m) => m.slice(1).toLowerCase()),
  );
  return [...set];
}

export async function listTeamMentionCandidates(
  teamId: string,
): Promise<MentionCandidate[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: teamMembers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    );

  return rows.map((row) => {
    const display = displayName(row);
    return {
      userId: row.userId,
      displayName: display,
      handle: handleFromName(display) || row.email.split("@")[0] || "user",
    };
  });
}

export async function resolveMentionUserIds(
  teamId: string,
  text: string,
): Promise<string[]> {
  const tokens = extractMentionTokens(text);
  if (tokens.length === 0) return [];
  const candidates = await listTeamMentionCandidates(teamId);
  const ids = new Set<string>();
  for (const token of tokens) {
    const hit = candidates.find(
      (c) =>
        c.handle.toLowerCase() === token ||
        c.displayName.toLowerCase().replace(/\s+/g, "") === token ||
        c.displayName.toLowerCase().split(/\s+/)[0] === token,
    );
    if (hit) ids.add(hit.userId);
  }
  return [...ids];
}

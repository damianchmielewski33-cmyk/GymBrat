import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import { generateTeamInviteCode } from "@/lib/community/team-codes";
import { type TeamPrivacy, type TeamRankingMetric } from "@/lib/community/team-types";
import { localDateKey } from "@/lib/local-date";

export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export const BANNER_COLORS = [
  "#1a1a1c",
  "#12181f",
  "#1c1612",
  "#141c18",
  "#1a1420",
] as const;

export function displayNameFromUser(row: {
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

export function asPrivacy(value: string): TeamPrivacy {
  return value === "public" ? "public" : "private";
}

export function asMetric(value: string): TeamRankingMetric {
  if (
    value === "tonnage" ||
    value === "cardio" ||
    value === "fcs" ||
    value === "sessions"
  ) {
    return value;
  }
  return "fcs";
}

export async function uniqueInviteCode(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateTeamInviteCode();
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.inviteCode, code))
      .limit(1);
    if (!existing) return code;
  }
  return generateTeamInviteCode(10);
}

export async function refreshMemberCount(teamId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    );
  const count = Number(row?.count ?? 0);
  await db
    .update(teams)
    .set({ memberCount: count, updatedAt: new Date() })
    .where(eq(teams.id, teamId));
  return count;
}

export function weekStartDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateKey(d);
}

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { teamInvitations, teamMembers, teams, users } from "@/db/schema";
import { generateInviteToken } from "@/lib/community/team-codes";
import { canInviteMembers } from "@/lib/community/team-permissions";
import { isAssignableTeamRole, type AssignableTeamRole } from "@/lib/community/team-types";
import { joinTeamByCode } from "@/lib/community/teams";
import { getActiveMembership } from "@/lib/community/teams-queries";
import { INVITE_TTL_MS, displayNameFromUser } from "@/lib/community/teams-shared";

export async function createEmailInvitation(
  actorUserId: string,
  teamId: string,
  rawEmail: string,
  role: AssignableTeamRole = "member",
) {
  const membership = await getActiveMembership(teamId, actorUserId);
  if (!canInviteMembers(membership?.role ?? null)) {
    return { ok: false as const, error: "Brak uprawnień do zapraszania." };
  }
  if (role === "admin" && membership?.role !== "owner") {
    return {
      ok: false as const,
      error: "Tylko Owner może zapraszać na rolę Admin.",
    };
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Podaj poprawny adres e-mail." };
  }

  const db = getDb();
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), isNull(teams.archivedAt)))
    .limit(1);
  if (!team) return { ok: false as const, error: "Grupa nie istnieje." };
  if (team.memberCount >= team.maxMembers) {
    return { ok: false as const, error: "Grupa osiągnęła limit członków." };
  }

  const [invitee] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (invitee) {
    const existing = await getActiveMembership(teamId, invitee.id);
    if (existing) {
      return { ok: false as const, error: "Ta osoba jest już w grupie." };
    }
  }

  const [pending] = await db
    .select({ id: teamInvitations.id })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
        invitee
          ? eq(teamInvitations.inviteeUserId, invitee.id)
          : eq(teamInvitations.inviteeEmail, email),
      ),
    )
    .limit(1);
  if (pending) {
    return { ok: false as const, error: "Zaproszenie już oczekuje na odpowiedź." };
  }

  const token = generateInviteToken();
  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(teamInvitations).values({
    id,
    teamId,
    invitedByUserId: actorUserId,
    inviteeUserId: invitee?.id ?? null,
    inviteeEmail: email,
    role,
    token,
    status: "pending",
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
  });

  if (invitee?.id) {
    void (async () => {
      try {
        const { emitNotification } = await import(
          "@/lib/community/notifications"
        );
        const [actor] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, actorUserId))
          .limit(1);
        const actorName = actor ? displayNameFromUser(actor) : "Ktoś";
        await emitNotification({
          userId: invitee.id,
          kind: "invite",
          title: "Zaproszenie do grupy",
          body: `${actorName} zaprasza Cię do „${team.name}”.`,
          href: `/community/teams`,
          actorUserId: actorUserId,
          actorDisplayName: actorName,
          teamId,
          entityType: "invitation",
          entityId: id,
          groupKey: `invite:${id}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  return {
    ok: true as const,
    invitationId: id,
    token,
    inviteCode: team.inviteCode,
  };
}

export async function acceptInvitation(userId: string, userEmail: string, token: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [invite] = await db
    .select()
    .from(teamInvitations)
    .where(
      and(eq(teamInvitations.token, token), eq(teamInvitations.status, "pending")),
    )
    .limit(1);
  if (!invite) {
    return { ok: false as const, error: "Zaproszenie jest nieaktualne." };
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(teamInvitations)
      .set({ status: "expired", respondedAt: new Date() })
      .where(eq(teamInvitations.id, invite.id));
    return { ok: false as const, error: "Zaproszenie wygasło." };
  }

  const email = userEmail.trim().toLowerCase();
  const allowed =
    invite.inviteeUserId === userId ||
    (invite.inviteeEmail && invite.inviteeEmail === email);
  if (!allowed) {
    return {
      ok: false as const,
      error: "To zaproszenie jest przypisane do innego konta.",
    };
  }

  const role = isAssignableTeamRole(invite.role) ? invite.role : "member";
  const join = await joinTeamByCode(
    userId,
    (
      await db
        .select({ inviteCode: teams.inviteCode })
        .from(teams)
        .where(eq(teams.id, invite.teamId))
        .limit(1)
    )[0]?.inviteCode ?? "",
    { joinMethod: "invite" },
  );
  if (!join.ok) return join;

  if (role !== "member") {
    const membership = await getActiveMembership(invite.teamId, userId);
    if (membership && membership.role !== "owner") {
      await db
        .update(teamMembers)
        .set({ role })
        .where(eq(teamMembers.id, membership.id));
    }
  }

  await db
    .update(teamInvitations)
    .set({
      status: "accepted",
      respondedAt: new Date(),
      inviteeUserId: userId,
    })
    .where(eq(teamInvitations.id, invite.id));

  return { ok: true as const, teamId: invite.teamId };
}

export async function declineInvitation(
  userId: string,
  userEmail: string,
  token: string,
) {
  await ensureCriticalSchema();
  const db = getDb();
  const [invite] = await db
    .select()
    .from(teamInvitations)
    .where(
      and(eq(teamInvitations.token, token), eq(teamInvitations.status, "pending")),
    )
    .limit(1);
  if (!invite) {
    return { ok: false as const, error: "Zaproszenie jest nieaktualne." };
  }
  const email = userEmail.trim().toLowerCase();
  const allowed =
    invite.inviteeUserId === userId ||
    (invite.inviteeEmail && invite.inviteeEmail === email);
  if (!allowed) {
    return { ok: false as const, error: "To zaproszenie nie jest dla Ciebie." };
  }
  await db
    .update(teamInvitations)
    .set({ status: "declined", respondedAt: new Date() })
    .where(eq(teamInvitations.id, invite.id));
  return { ok: true as const };
}

export async function revokeInvitation(
  actorUserId: string,
  teamId: string,
  invitationId: string,
) {
  const membership = await getActiveMembership(teamId, actorUserId);
  if (!canInviteMembers(membership?.role ?? null)) {
    return { ok: false as const, error: "Brak uprawnień." };
  }
  const db = getDb();
  await db
    .update(teamInvitations)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
      ),
    );
  return { ok: true as const };
}

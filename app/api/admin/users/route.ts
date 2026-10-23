import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import { getProtectedAdminUserIds, isOwnerAdminActor } from "@/lib/admin-session";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";

async function handleGET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const db = getDb();
  const [rows, protectedUserIds, canGrantAdmin] =
    await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
          appRole: users.appRole,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
      getProtectedAdminUserIds(),
      isOwnerAdminActor(gate.session),
    ]);

  return NextResponse.json({
    users: rows,
    protectedUserIds,
    canGrantAdmin,
  });
}

export const GET = withApiErrors(handleGET);

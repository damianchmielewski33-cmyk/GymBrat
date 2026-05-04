import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdminApi } from "@/lib/admin-api";
import { getFounderUserId } from "@/lib/admin-session";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const db = getDb();
  const [rows, founderUserId] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        appRole: users.appRole,
        createdAt: users.createdAt,
        aiEntitled: userSettings.aiEntitled,
      })
      .from(users)
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .orderBy(desc(users.createdAt)),
    getFounderUserId(),
  ]);

  return NextResponse.json({ users: rows, founderUserId });
}

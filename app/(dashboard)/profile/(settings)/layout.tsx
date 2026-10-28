import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { LogoutButton } from "@/components/profile/logout-button";
import { ProfileTabs } from "@/components/profile/profile-ui";

function initialsOf(
  first: string | null,
  last: string | null,
  fallback: string,
): string {
  const letters = `${first?.trim()[0] ?? ""}${last?.trim()[0] ?? ""}`;
  return (letters || fallback.trim()[0] || "?").toUpperCase();
}

/**
 * Layout ustawień profilu — bez `workout-plan` (UX U-5 / ADR 0006).
 * Wiersz konta bez kafelków wagi (UX U-1).
 */
export default async function ProfileSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [u] = await db
    .select({
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const displayName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
    u?.name ||
    "Zawodnik";

  return (
    <div className="space-y-4">
      <section className="app-card-raised p-5 sm:p-6" aria-label="Twoje konto">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/12 font-heading text-xl font-semibold text-[var(--gym-gold)]"
          >
            {initialsOf(
              u?.firstName ?? null,
              u?.lastName ?? null,
              displayName,
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-white">
              {displayName}
            </p>
            <p className="truncate text-[13px] text-white/50">{u?.email}</p>
          </div>
          <LogoutButton className="h-10 shrink-0 rounded-xl px-3 text-[13px]" />
        </div>
      </section>

      <ProfileTabs />

      {children}
    </div>
  );
}

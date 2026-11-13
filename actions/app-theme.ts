"use server";

import { guardAction } from "@/lib/action-guard";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { APP_THEMES, THEME_COOKIE, type AppTheme } from "@/lib/app-theme";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/** Zapisuje motyw / kolor akcentu aplikacji na koncie (ten sam na każdym urządzeniu). */
export async function updateAppThemeAction(raw: unknown): Promise<{
  ok: boolean;
  error?: string;
  theme?: AppTheme;
}> {
  await guardAction("app-theme.updateAppThemeAction");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };
  }
  if (typeof raw !== "string" || !(APP_THEMES as readonly string[]).includes(raw)) {
    return { ok: false, error: "Nieprawidłowy motyw." };
  }
  const theme = raw as AppTheme;
  const db = getDb();
  const userId = session.user.id;

  const [existing] = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userSettings)
      .set({ appTheme: theme, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      weeklyCardioGoalMinutes: 150,
      appTheme: theme,
    });
  }

  // Ciasteczko tylko do pierwszego renderu bez migania; źródło prawdy to baza.
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/profile");
  return { ok: true, theme };
}

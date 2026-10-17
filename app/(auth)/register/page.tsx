import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";
import { isUserBodyProfileComplete } from "@/lib/profile-complete";

type Search = Promise<{ oauth?: string | string[] }>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  const sp = searchParams ? await searchParams : {};
  const oauthRaw = sp.oauth;
  const oauthFlag = Array.isArray(oauthRaw) ? oauthRaw[0] : oauthRaw;
  const wantsOauthContinue = oauthFlag === "1";

  const session = await auth().catch(() => null);
  let oauthPrefill: {
    firstName: string;
    lastName: string;
    email: string;
  } | null = null;

  if (session?.user?.id && session.user.profileComplete !== true) {
    const db = getDb();
    const [row] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        weightKg: users.weightKg,
        heightCm: users.heightCm,
        age: users.age,
        activityLevel: users.activityLevel,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (row && !isUserBodyProfileComplete(row)) {
      oauthPrefill = {
        firstName: row.firstName?.trim() || "",
        lastName: row.lastName?.trim() || "",
        email: row.email,
      };
    }
  }

  const oauthContinue = Boolean(oauthPrefill) || wantsOauthContinue;

  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-white/50">Ładowanie…</div>
      }
    >
      <RegisterForm
        googleEnabled={isGoogleAuthConfigured()}
        facebookEnabled={isFacebookAuthConfigured()}
        oauthContinue={oauthContinue}
        oauthPrefill={oauthPrefill}
      />
    </Suspense>
  );
}

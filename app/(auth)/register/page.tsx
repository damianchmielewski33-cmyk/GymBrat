import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isUserBodyProfileComplete } from "@/lib/profile-complete";
import {
  getRegistrationAvailability,
  TEST_REGISTER_CODE,
} from "@/lib/register-email-mode";

type Search = Promise<{
  oauth?: string | string[];
  notice?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Search;
}) {
  const sp = searchParams ? await searchParams : {};
  const wantsOauthContinue = firstParam(sp.oauth) === "1";
  const accountResetNotice = firstParam(sp.notice) === "account_reset";
  const availability = getRegistrationAvailability();

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
    <div className="mx-auto w-full max-w-xl">
      <Suspense
        fallback={
          <div className="text-center text-sm text-white/50">Ładowanie…</div>
        }
      >
        <RegisterForm
          availability={availability}
          emailTestCode={
            availability.emailMode === "test" ? TEST_REGISTER_CODE : null
          }
          oauthContinue={oauthContinue}
          oauthPrefill={oauthPrefill}
          accountResetNotice={oauthContinue && accountResetNotice}
        />
      </Suspense>
    </div>
  );
}

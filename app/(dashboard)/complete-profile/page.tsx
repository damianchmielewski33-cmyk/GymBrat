import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { AuthSessionHydrating } from "@/components/auth/auth-session-hydrating";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { CompleteProfileSessionBridge } from "@/components/auth/complete-profile-session-bridge";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hasAuthSessionCookie } from "@/lib/auth-session-cookie";
import { isUserBodyProfileComplete } from "@/lib/profile-complete";

export default async function CompleteProfilePage() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    const jar = await cookies();
    if (hasAuthSessionCookie((name) => jar.has(name))) {
      return <AuthSessionHydrating />;
    }
    redirect("/login?callbackUrl=/complete-profile");
  }

  const db = getDb();
  const [row] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      weightKg: users.weightKg,
      heightCm: users.heightCm,
      age: users.age,
      activityLevel: users.activityLevel,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    redirect("/login");
  }

  // JWT niepełny + DB pełna → soft redirect("/") pętli z proxy. Najpierw odśwież sesję.
  if (isUserBodyProfileComplete(row)) {
    if (session.user.profileComplete === true) {
      redirect("/");
    }
    return <CompleteProfileSessionBridge />;
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <AuthHeroBrand
        headline="Dokończ profil"
        support="Konto Google jest gotowe — uzupełnij dane jak przy rejestracji, żeby Start i dieta działały poprawnie."
      />
      <div className="glass-panel gold-panel relative overflow-hidden p-6 sm:p-8">
        <p className="mb-5 text-sm text-white/55">
          Zalogowano jako{" "}
          <span className="font-medium text-white/85">{row.email}</span>
        </p>
        <CompleteProfileForm
          initial={{
            firstName: row.firstName,
            lastName: row.lastName,
            weightKg: row.weightKg,
            heightCm: row.heightCm,
            age: row.age,
            activityLevel: row.activityLevel,
          }}
        />
      </div>
    </div>
  );
}

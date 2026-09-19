import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { completeOnboardingAction } from "@/actions/onboarding";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScreenCard, ScreenHeading, screenLinkClass } from "@/components/layout/screen";

async function submitOnboarding(formData: FormData) {
  "use server";
  const raw = formData.get("weekly");
  const n = typeof raw === "string" ? Number(raw) : NaN;
  const weekly = Number.isFinite(n) ? Math.min(14, Math.max(1, Math.round(n))) : 4;
  await completeOnboardingAction({ weeklySessions: weekly });
  redirect("/");
}

export default async function OnboardingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/onboarding");

  const db = getDb();
  const [row] = await db
    .select({ onboardingCompletedAt: userSettings.onboardingCompletedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (row?.onboardingCompletedAt) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-lg">
      <ScreenCard>
        <ScreenHeading
          className="mb-8"
          kicker="Start"
          title="Konfiguracja"
          description="Ile dni w tygodniu chcesz trenować? Cele doprecyzujesz później w profilu."
        />
        <form className="space-y-6" action={submitOnboarding}>
          <div className="space-y-2">
            <Label htmlFor="weekly">Dni treningowych / tydzień</Label>
            <Input
              id="weekly"
              name="weekly"
              type="number"
              min={1}
              max={7}
              defaultValue={4}
              required
            />
          </div>
          <p className="text-xs text-white/45">
            Token Fitatu i makra ustawisz w{" "}
            <Link href="/profile" className={screenLinkClass}>
              profilu
            </Link>
            .
          </p>
          <Button type="submit" variant="cta" className="w-full">
            Zapisz i przejdź do Start
          </Button>
        </form>
      </ScreenCard>
    </div>
  );
}

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
    <div className="mx-auto max-w-lg space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Start
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Konfiguracja
        </h1>
        <p className="mt-2 text-sm text-white/65">
          Ile dni w tygodniu chcesz trenować? Możesz doprecyzować cele później w profilu.
        </p>
      </header>

      <form className="glass-panel space-y-6 p-8" action={submitOnboarding}>
        <div className="space-y-2">
          <Label htmlFor="weekly" className="text-white/80">
            Dni treningowych / tydzień
          </Label>
          <Input
            id="weekly"
            name="weekly"
            type="number"
            min={1}
            max={7}
            defaultValue={4}
            required
            className="h-11 border-white/12 bg-white/[0.05] text-white"
          />
        </div>
        <p className="text-xs text-white/45">
          Token Fitatu i makra ustawisz w{" "}
          <Link href="/profile" className="text-[var(--neon)] underline-offset-2 hover:underline">
            profilu
          </Link>
          .
        </p>
        <Button
          type="submit"
          className="h-11 w-full bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
        >
          Zapisz i przejdź do Start
        </Button>
      </form>
    </div>
  );
}

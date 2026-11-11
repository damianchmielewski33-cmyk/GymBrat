import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { EditGate } from "@/components/profile/edit-gate";
import { BodyParamsForm } from "@/components/profile/body-params-form";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  formatCurrentWeightLabel,
  getCurrentWeightKg,
} from "@/lib/current-weight";
import { calendarDateKey } from "@/lib/local-date";

export const metadata = { title: "Ciało i dane" };

export default async function ProfileBodyPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [u] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      heightCm: users.heightCm,
      age: users.age,
      sex: users.sex,
      activityLevel: users.activityLevel,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const currentWeight = await getCurrentWeightKg(userId);
  const today = calendarDateKey();
  const weightHint = formatCurrentWeightLabel(currentWeight, today);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Ciało i dane"
        description="Baza do raportów, kalorii z cardio i zapotrzebowania."
      />
      <p className="text-xs text-white/50">
        {currentWeight
          ? `Aktualna waga: ${weightHint}`
          : "Uzupełnij wagę — pokażemy ją też na Start i w Analizie."}
      </p>
      <EditGate>
      <BodyParamsForm
        initial={{
          firstName: u?.firstName ?? "",
          lastName: u?.lastName ?? "",
          weightKg: currentWeight?.weightKg ?? null,
          heightCm: u?.heightCm ?? null,
          age: u?.age ?? null,
          sex: u?.sex ?? null,
          activityLevel: u?.activityLevel ?? null,
        }}
      />
      </EditGate>
    </div>
  );
}

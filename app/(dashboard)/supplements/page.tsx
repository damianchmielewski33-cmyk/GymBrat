import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SupplementsManageClient } from "@/components/supplements/supplements-manage-client";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { resolveDietSupplementItems } from "@/lib/diet-supplements";

export default async function SupplementsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/supplements");

  const db = getDb();
  const [row] = await db
    .select({
      fitnessGoalsJson: userSettings.fitnessGoalsJson,
      mealTemplatesJson: userSettings.mealTemplatesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const initial = resolveDietSupplementItems(
    row?.fitnessGoalsJson,
    row?.mealTemplatesJson,
  );

  return (
    <div className="px-1 pt-1 sm:px-0">
      <SupplementsManageClient initial={initial} />
    </div>
  );
}

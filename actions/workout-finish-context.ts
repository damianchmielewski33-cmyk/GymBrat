"use server";

import { auth } from "@/auth";
import { getTreningiHubStats } from "@/lib/treningi-hub-stats";

/** Kontekst do stopki ekranu „Trening zrobiony” (treningi w bieżącym tygodniu). */
export async function fetchWorkoutFinishContextAction(): Promise<{
  workoutsThisWeek: number;
}> {
  const session = await auth();
  if (!session?.user?.id) return { workoutsThisWeek: 0 };
  const stats = await getTreningiHubStats(session.user.id);
  return { workoutsThisWeek: stats.workoutsThisWeek };
}

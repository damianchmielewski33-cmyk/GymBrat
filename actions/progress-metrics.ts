"use server";

import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import { getProgressHubData } from "@/lib/progress-hub";
import { loadProgressBodyMetrics } from "@/lib/progress-metrics/body";
import type { ProgressTabData } from "@/lib/progress-metrics/types";

async function loadForSignedInUser(actionName: string) {
  await guardAction(actionName);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sesja wygasła.");
  return getProgressHubData(userId);
}

export async function getOverviewMetricsAction(): Promise<ProgressTabData["przeglad"]> {
  const data = await loadForSignedInUser("progress.metrics.overview");
  return { intelligence: data.intelligence, body: data.body, week: data.week };
}

export async function getStrengthMetricsAction(): Promise<ProgressTabData["sila"]> {
  const data = await loadForSignedInUser("progress.metrics.strength");
  return { strength: data.strength, intelligence: data.intelligence };
}

export async function getBodyMetricsAction(): Promise<ProgressTabData["sylwetka"]> {
  await guardAction("progress.metrics.body");
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesja wygasła.");
  return { body: await loadProgressBodyMetrics(session.user.id) };
}

export async function getWeekMetricsAction(): Promise<ProgressTabData["tydzien"]> {
  const data = await loadForSignedInUser("progress.metrics.week");
  return { week: data.week, intelligence: data.intelligence };
}

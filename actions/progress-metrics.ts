"use server";

import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import type { StrengthOverviewResult } from "@/lib/strength-overview";
import { computeStrengthOverview } from "@/lib/strength-overview-service";
import { loadProgressBodyMetrics } from "@/lib/progress-metrics/body";
import { loadProgressOverviewMetrics } from "@/lib/progress-metrics/overview";
import { loadProgressStrengthMetrics } from "@/lib/progress-metrics/strength";
import { loadProgressWeekMetrics } from "@/lib/progress-metrics/week";
import type { ProgressTabData } from "@/lib/progress-metrics/types";

async function getSignedInUserId(actionName: string) {
  await guardAction(actionName);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sesja wygasła.");
  return userId;
}

export async function getOverviewMetricsAction(): Promise<ProgressTabData["przeglad"]> {
  const userId = await getSignedInUserId("progress.metrics.overview");
  return loadProgressOverviewMetrics(userId);
}

export async function getStrengthMetricsAction(): Promise<ProgressTabData["sila"]> {
  const userId = await getSignedInUserId("progress.metrics.strength");
  return loadProgressStrengthMetrics(userId);
}

export async function getBodyMetricsAction(): Promise<ProgressTabData["sylwetka"]> {
  await guardAction("progress.metrics.body");
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesja wygasła.");
  return { body: await loadProgressBodyMetrics(session.user.id) };
}

export async function getWeekMetricsAction(): Promise<ProgressTabData["tydzien"]> {
  const userId = await getSignedInUserId("progress.metrics.week");
  return loadProgressWeekMetrics(userId);
}

/**
 * Widok zbiorczy siły: czy siła średnio rośnie czy spada (wszystkie ćwiczenia i grupy mięśniowe).
 * Walidacja wejścia i zapytanie (zawsze po `userId`) w `computeStrengthOverview`;
 * niepoprawne wejście/zakres zwraca `ok: false`, brak sesji rzuca jak pozostałe metryki.
 */
export async function getStrengthOverviewAction(
  input: unknown,
): Promise<StrengthOverviewResult> {
  const userId = await getSignedInUserId("progress.metrics.strength-overview");
  return computeStrengthOverview(userId, input);
}

import { buildProgressIntelligence, emptyProgressIntelligence, type AnalyticsCardioSample, type AnalyticsStrengthSession, type MuscleSetContribution, type ProgressIntelligence, type SexKind } from "@/lib/analytics";
import { getBodyReports } from "@/lib/body-reports";
import { emptyProgressDietTrainingBlock } from "@/lib/diet-training-weeks";
import { addCalendarDays } from "@/lib/local-date";
import { getCardioWeekSummary } from "@/lib/cardio-week";
import { safeRound1 } from "@/lib/progress-hub-helpers";
import type { ExAgg } from "@/lib/progress-hub-exercises";

/** Sekcja inteligencji Postępów (Z88a). */
/** Analityka (inteligencja) — składa sygnały siłowe, cardio, dietę i subiektywne check-iny. */
export async function buildIntelligenceSection(args: {
  userId: string;
  today: string;
  wantsIntelligence: boolean;
  weeklyTarget: number;
  cardioGoal: number;
  strengthDaySet: Set<string>;
  checkinRows: Array<{ date: string; sleepQuality: number | null; dayEnergy: number | null; stress: number | null; weightKg: number | null }>;
  deltaVsPrevKg: number | null;
  lastReportDate: string | null;
  dietTraining: ReturnType<typeof emptyProgressDietTrainingBlock>;
  userRow: { age: number | null; weightKg: number | null; sex: string | null } | null;
  currentKg: number | null;
  bodyReports: Awaited<ReturnType<typeof getBodyReports>>;
  analyticsStrengthSessions: AnalyticsStrengthSession[];
  analyticsStrengthDates: string[];
  analyticsCardioSamples: AnalyticsCardioSample[];
  byExercise: Map<string, ExAgg>;
  muscleContributions: MuscleSetContribution[];
}) {
  const { userId, today, wantsIntelligence, weeklyTarget, cardioGoal, strengthDaySet, checkinRows, deltaVsPrevKg, lastReportDate, dietTraining, userRow, currentKg, bodyReports, analyticsStrengthSessions, analyticsStrengthDates, analyticsCardioSamples, byExercise, muscleContributions } = args;
  let consecutiveTrainingDays = 0;
  {
    let cursor = today;
    for (let i = 0; i < 21; i++) {
      if (strengthDaySet.has(cursor)) {
        consecutiveTrainingDays += 1;
        cursor = addCalendarDays(cursor, -1);
      } else {
        break;
      }
    }
  }

  const latestCheckin = checkinRows[0] ?? null;
  const checkinWeekAgo = checkinRows.find((c) => {
    const gap =
      (new Date(`${today}T12:00:00`).getTime() -
        new Date(`${c.date}T12:00:00`).getTime()) /
      (24 * 60 * 60 * 1000);
    return gap >= 5 && gap <= 10;
  });
  const weightDeltaKg7d =
    latestCheckin?.weightKg != null && checkinWeekAgo?.weightKg != null
      ? safeRound1(latestCheckin.weightKg - checkinWeekAgo.weightKg)
      : deltaVsPrevKg != null &&
          lastReportDate != null &&
          (() => {
            const gap =
              (new Date(`${today}T12:00:00`).getTime() -
                new Date(`${lastReportDate}T12:00:00`).getTime()) /
              (24 * 60 * 60 * 1000);
            return gap <= 10;
          })()
        ? deltaVsPrevKg
        : null;

  const dietAdherencePct =
    dietTraining.current?.calorieAdherencePct ??
    (dietTraining.weeks.length
      ? (() => {
          const vals = dietTraining.weeks
            .map((w) => w.calorieAdherencePct)
            .filter((x): x is number => x != null);
          if (!vals.length) return null;
          return (
            Math.round(
              (vals.reduce((a, b) => a + b, 0) / vals.length) * 10,
            ) / 10
          );
        })()
      : null);

  const sexRaw = (userRow?.sex ?? "").trim().toLowerCase();
  const sex: SexKind | null =
    sexRaw === "male" || sexRaw === "female" ? sexRaw : null;

  // Minuty cardio tygodnia — ta sama funkcja co Pulpit i Trening (US12).
  const cardioWeekSummary = await getCardioWeekSummary(userId, { todayKey: today });

  let intelligence: ProgressIntelligence = emptyProgressIntelligence();
  if (wantsIntelligence) {
    try {
      intelligence = buildProgressIntelligence({
      today,
      weeklySessionsTarget: weeklyTarget,
      weeklyCardioGoalMinutes: cardioGoal,
      cardioWeekMode: cardioWeekSummary.mode,
      ageYears: userRow?.age ?? null,
      weightKg: userRow?.weightKg ?? currentKg,
      sex,
      strengthSessions: analyticsStrengthSessions,
      strengthDates: analyticsStrengthDates,
      consecutiveTrainingDays,
      exercises: [...byExercise.values()].map((e) => ({
        exerciseKey: e.key,
        name: e.name,
        points: e.points,
        primaryRegion: e.primaryRegion,
      })),
      muscleContributions,
      cardioSamples: analyticsCardioSamples,
      subjective: latestCheckin
        ? {
            sleepQuality: latestCheckin.sleepQuality,
            dayEnergy: latestCheckin.dayEnergy,
            stress: latestCheckin.stress,
            weightDeltaKg7d,
          }
        : bodyReports[0]
          ? {
              sleepQuality: bodyReports[0].sleepQuality ?? null,
              dayEnergy: bodyReports[0].dayEnergy ?? null,
              stress: null,
              weightDeltaKg7d,
            }
          : null,
      dietAdherencePct,
      });
    } catch (e) {
      console.error(
        "[progress-hub] intelligence",
        e instanceof Error ? e.message : e,
      );
      intelligence = emptyProgressIntelligence();
    }
  }
  return { intelligence, cardioWeekSummary };
}

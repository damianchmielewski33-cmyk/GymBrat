export type AchievementIcon =
  | "ribbon"
  | "flame"
  | "dumbbell"
  | "scale"
  | "trophy";

export type AchievementDef = {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  /** ISO date when unlocked, or null if locked */
  unlockedAt: string | null;
};

export type AchievementInput = {
  totalTonnageKg: number;
  totalStrengthSessions: number;
  streakWeeks: number;
  weightDeltaKg: number | null;
  waistDeltaCm: number | null;
  firstWorkoutDate: string | null;
  firstReportDate: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * In-memory achievements from existing workout / body data — no new tables.
 */
export function computeAchievements(input: AchievementInput): AchievementDef[] {
  const unlocked = todayIso();
  const defs: Array<{
    id: string;
    title: string;
    description: string;
    icon: AchievementIcon;
    ok: boolean;
    at: string | null;
  }> = [
    {
      id: "first-workout",
      title: "Pierwszy trening",
      description: "łącznie",
      icon: "dumbbell",
      ok: input.totalStrengthSessions >= 1,
      at: input.firstWorkoutDate,
    },
    {
      id: "sessions-10",
      title: "10 treningów",
      description: "łącznie",
      icon: "dumbbell",
      ok: input.totalStrengthSessions >= 10,
      at: unlocked,
    },
    {
      id: "sessions-50",
      title: "50 treningów",
      description: "łącznie",
      icon: "dumbbell",
      ok: input.totalStrengthSessions >= 50,
      at: unlocked,
    },
    {
      id: "tonnage-10t",
      title: "10 t podniesione",
      description: "tonaż łączny",
      icon: "ribbon",
      ok: input.totalTonnageKg >= 10_000,
      at: unlocked,
    },
    {
      id: "tonnage-25t",
      title: "25 t podniesione",
      description: "tonaż łączny",
      icon: "ribbon",
      ok: input.totalTonnageKg >= 25_000,
      at: unlocked,
    },
    {
      id: "tonnage-50t",
      title: "50 t podniesione",
      description: "tonaż łączny",
      icon: "ribbon",
      ok: input.totalTonnageKg >= 50_000,
      at: unlocked,
    },
    {
      id: "tonnage-100t",
      title: "100 t podniesione",
      description: "tonaż łączny",
      icon: "ribbon",
      ok: input.totalTonnageKg >= 100_000,
      at: unlocked,
    },
    {
      id: "streak-2",
      title: "2 tygodnie z rzędu",
      description: "co tydzień trening",
      icon: "flame",
      ok: input.streakWeeks >= 2,
      at: unlocked,
    },
    {
      id: "streak-3",
      title: "3 tygodnie z rzędu",
      description: "co tydzień trening",
      icon: "flame",
      ok: input.streakWeeks >= 3,
      at: unlocked,
    },
    {
      id: "streak-8",
      title: "8 tygodni z rzędu",
      description: "co tydzień trening",
      icon: "flame",
      ok: input.streakWeeks >= 8,
      at: unlocked,
    },
    {
      id: "first-report",
      title: "Pierwszy raport",
      description: "sylwetka",
      icon: "scale",
      ok: Boolean(input.firstReportDate),
      at: input.firstReportDate,
    },
    {
      id: "weight-minus-2",
      title: "−2 kg",
      description: "od startu",
      icon: "scale",
      ok: input.weightDeltaKg != null && input.weightDeltaKg <= -2,
      at: unlocked,
    },
    {
      id: "weight-minus-5",
      title: "−5 kg",
      description: "od startu",
      icon: "scale",
      ok: input.weightDeltaKg != null && input.weightDeltaKg <= -5,
      at: unlocked,
    },
    {
      id: "weight-minus-6",
      title: "−6 kg",
      description: "od startu",
      icon: "scale",
      ok: input.weightDeltaKg != null && input.weightDeltaKg <= -6,
      at: unlocked,
    },
    {
      id: "weight-minus-7",
      title: "−7 kg",
      description: "od startu",
      icon: "scale",
      ok: input.weightDeltaKg != null && input.weightDeltaKg <= -7,
      at: unlocked,
    },
    {
      id: "waist-minus-5",
      title: "−5 cm pasa",
      description: "od startu",
      icon: "scale",
      ok: input.waistDeltaCm != null && input.waistDeltaCm <= -5,
      at: unlocked,
    },
  ];

  return defs.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    icon: d.icon,
    unlockedAt: d.ok ? (d.at ?? unlocked) : null,
  }));
}

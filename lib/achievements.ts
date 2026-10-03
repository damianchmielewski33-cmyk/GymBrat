export type AchievementDef = {
  id: string;
  title: string;
  description: string;
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
    ok: boolean;
    at: string | null;
  }> = [
    {
      id: "first-workout",
      title: "Pierwszy trening",
      description: "Zaliczyłeś pierwszą sesję siłową.",
      ok: input.totalStrengthSessions >= 1,
      at: input.firstWorkoutDate,
    },
    {
      id: "sessions-10",
      title: "10 treningów",
      description: "Dziesięć ukończonych sesji siłowych.",
      ok: input.totalStrengthSessions >= 10,
      at: unlocked,
    },
    {
      id: "sessions-50",
      title: "50 treningów",
      description: "Pół setki sesji na koncie.",
      ok: input.totalStrengthSessions >= 50,
      at: unlocked,
    },
    {
      id: "tonnage-10t",
      title: "10 ton",
      description: "Łączny tonaż przekroczył 10 000 kg.",
      ok: input.totalTonnageKg >= 10_000,
      at: unlocked,
    },
    {
      id: "tonnage-50t",
      title: "50 ton",
      description: "Łączny tonaż przekroczył 50 000 kg.",
      ok: input.totalTonnageKg >= 50_000,
      at: unlocked,
    },
    {
      id: "tonnage-100t",
      title: "100 ton",
      description: "Stu-tonowy próg objętości.",
      ok: input.totalTonnageKg >= 100_000,
      at: unlocked,
    },
    {
      id: "streak-3",
      title: "Seria 3 tygodni",
      description: "Trening siłowy przez 3 tygodnie z rzędu.",
      ok: input.streakWeeks >= 3,
      at: unlocked,
    },
    {
      id: "streak-8",
      title: "Seria 8 tygodni",
      description: "Osiem tygodni bez przerwy w planie.",
      ok: input.streakWeeks >= 8,
      at: unlocked,
    },
    {
      id: "first-report",
      title: "Pierwszy raport",
      description: "Dodałeś pierwszy raport sylwetki.",
      ok: Boolean(input.firstReportDate),
      at: input.firstReportDate,
    },
    {
      id: "weight-minus-2",
      title: "−2 kg",
      description: "Spadek wagi o co najmniej 2 kg od startu.",
      ok: input.weightDeltaKg != null && input.weightDeltaKg <= -2,
      at: unlocked,
    },
    {
      id: "weight-minus-5",
      title: "−5 kg",
      description: "Spadek wagi o co najmniej 5 kg od startu.",
      ok: input.weightDeltaKg != null && input.weightDeltaKg <= -5,
      at: unlocked,
    },
    {
      id: "waist-minus-5",
      title: "−5 cm pasa",
      description: "Obwód pasa mniejszy o 5 cm lub więcej.",
      ok: input.waistDeltaCm != null && input.waistDeltaCm <= -5,
      at: unlocked,
    },
  ];

  return defs.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    unlockedAt: d.ok ? (d.at ?? unlocked) : null,
  }));
}

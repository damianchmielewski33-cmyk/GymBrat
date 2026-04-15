import type { GymBratDiaryJson } from "../normalize-diary.js";

export function mockDiary(date: string, email: string): GymBratDiaryJson {
  const seed = email.length % 3;
  const target = 1750 + seed * 40;
  const m1 = 480;
  const m2 = 720;
  const m3 = Math.max(180, target - m1 - m2);
  const baseCal = m1 + m2 + m3;
  return {
    calories: baseCal,
    caloriesGoal: 2200,
    proteinG: 130 + seed * 5,
    proteinGoalG: 170,
    fatG: 55 + seed,
    fatGoalG: 72,
    carbsG: 190 + seed * 8,
    carbsGoalG: 240,
    meals: [
      {
        id: "1",
        name: "Śniadanie (mock most)",
        calories: m1,
        proteinG: 22,
        fatG: 14,
        carbsG: 62,
        loggedAt: `${date}T07:45:00.000Z`,
      },
      {
        id: "2",
        name: "Obiad (mock most)",
        calories: m2,
        proteinG: 58,
        fatG: 24,
        carbsG: 68,
        loggedAt: `${date}T13:10:00.000Z`,
      },
      {
        id: "3",
        name: "Kolacja (mock most)",
        calories: m3,
        proteinG: 50,
        fatG: 17,
        carbsG: 60,
        loggedAt: `${date}T20:30:00.000Z`,
      },
    ],
  };
}

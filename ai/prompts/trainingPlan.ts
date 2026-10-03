import type { FitatuDaySummary } from "@/types/fitatu";

export type TrainingPlanPromptInput = {
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "very_active";
  goals: string[];
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  equipment?: string[];
  injuriesOrLimitations?: string[];
  nutritionToday?: FitatuDaySummary | null;
  cardioPerformance?: {
    recent5kTimeSec?: number;
    vo2MaxEstimate?: number;
    restingHr?: number;
    maxHr?: number;
    notes?: string;
  };
};

export function trainingPlanSystemPrompt() {
  return [
    "You are a certified strength & conditioning coach and sports nutrition coach.",
    "You must be safe, realistic, and avoid medical claims.",
    "Return ONLY valid JSON that matches the provided schema. No markdown.",
  ].join("\n");
}

export function trainingPlanUserPrompt(input: TrainingPlanPromptInput) {
  const nutrition = input.nutritionToday
    ? {
        caloriesConsumed: input.nutritionToday.caloriesConsumed,
        caloriesGoal: input.nutritionToday.caloriesGoal,
        macros: input.nutritionToday.macros,
        mealsCount: input.nutritionToday.meals.length,
      }
    : null;

  return `
Create a 1-week training plan for this user.

User profile:
- age: ${input.age}
- weightKg: ${input.weightKg}
- heightCm: ${input.heightCm}
- activityLevel: ${input.activityLevel}
- experienceLevel: ${input.experienceLevel ?? "unknown"}
- goals: ${input.goals.join(", ")}
- daysPerWeek: ${input.daysPerWeek}
- equipment: ${(input.equipment ?? []).join(", ") || "unknown"}
- limitations: ${(input.injuriesOrLimitations ?? []).join(", ") || "none stated"}

GymBrat nutrition snapshot (local diary, most recent day):
${JSON.stringify(nutrition)}

Cardio performance:
${JSON.stringify(input.cardioPerformance ?? null)}

JSON schema to return:
{
  "overview": {
    "focus": string[],
    "weeklyScheduleSummary": string,
    "safetyNotes": string[]
  },
  "days": Array<{
    "day": 1|2|3|4|5|6|7,
    "title": string,
    "type": "strength"|"cardio"|"hybrid"|"rest",
    "session": {
      "warmup": string[],
      "main": Array<{
        "name": string,
        "sets": number,
        "reps": string,
        "restSec": number,
        "notes": string
      }>,
      "cardio": {
        "mode": string,
        "durationMin": number,
        "intensity": string,
        "notes": string
      } | null,
      "cooldown": string[]
    }
  }>,
  "nutritionGuidance": {
    "proteinGPerDay": number,
    "calorieTargetHint": string,
    "habitTips": string[]
  }
}
`;
}


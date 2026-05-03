export type ChatCoachPromptInput = {
  userProfile?: {
    age?: number;
    weightKg?: number;
    heightCm?: number;
    activityLevel?: string;
    goals?: string[];
    experienceLevel?: string;
    limitations?: string[];
  };
  /** Skrót danych z aplikacji (makra, trening, streak). */
  recentContext?: {
    nutritionSummary?: string;
    trainingSummary?: string;
    streakLine?: string;
    /** Czas lokalny kalendarza aplikacji — briefing dnia ma uwzględniać porę dnia. */
    briefingLocalTime?: string;
  };
  guardrails?: {
    tone?: "supportive" | "direct" | "strict";
  };
  /** Migawka bieżącej sesji treningu (tylko przy `active_session_tip`). */
  activeWorkout?: {
    sessionTitle: string;
    elapsedMinutes: number;
    sessionSetsDone: number;
    sessionSetsTotal: number;
    currentExercise: string;
    exerciseIndex: number;
    exerciseCount: number;
    currentExerciseSetsDone: number;
    currentExerciseSetCount: number;
    lastCompletedSet?: string | null;
    trigger: string;
    restRemainingSec: number | null;
  };
  /** Gdy `daily_briefing`, model pisze krótki briefing na dashboard, nie wątek czatu. */
  task?: "chat" | "daily_briefing" | "active_session_tip";
};

export function chatCoachSystemPrompt(input: ChatCoachPromptInput) {
  const tone = input.guardrails?.tone ?? "supportive";
  const rc = input.recentContext;
  const ctxLine = rc
    ? [
        rc.briefingLocalTime ? `Local calendar time: ${rc.briefingLocalTime}` : "",
        rc.nutritionSummary ? `Nutrition: ${rc.nutritionSummary}` : "",
        rc.trainingSummary ? `Training: ${rc.trainingSummary}` : "",
        rc.streakLine ? `Streaks: ${rc.streakLine}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    : "";
  const briefingRules =
    input.task === "daily_briefing"
      ? [
          "",
          "Task: Write ONLY the athlete's daily dashboard briefing (Polish).",
          "Length: 2–4 short sentences total.",
          "Ground at least one sentence in Recent app context (numbers/facts from context only; do not invent metrics).",
          "If Local calendar time is present: calibrate ALL wording to that moment. Late evening/night (e.g. 22:00–04:59 local): do NOT say the day is «just starting», «early morning», or push intense training; prefer recovery, sleep routine, light hydration/snack if macros allow, brief recap of the day. Morning: day-ahead framing is OK. Stay realistic.",
          "Include one practical suggestion that fits the actual time of day and the data (training, food habit, or recovery).",
          "No chat-style greeting (no «cześć», «witaj»). No signature line. No questions to the user unless critical.",
        ].join("\n")
      : "";

  const activeRules =
    input.task === "active_session_tip"
      ? [
          "",
          "Task: Live workout coaching tips (Polish only).",
          "Length: 2–4 short sentences total.",
          "Ground advice in the Active workout snapshot (exercise name, set counts, last set, rest timer if present). Do not invent lifts the user is not doing.",
          "Prefer: technique (ROM, brace, tempo), breathing, effort/RPE sanity, pacing between sets, or brief recovery cues when resting.",
          "No chat-style greeting. No signature. No questions unless safety-critical.",
        ].join("\n")
      : "";

  const awLine = input.activeWorkout
    ? `Active workout snapshot: ${JSON.stringify(input.activeWorkout)}`
    : "";

  const polishInstruction =
    input.task === "daily_briefing" || input.task === "active_session_tip"
      ? "Write the entire reply in Polish."
      : "Respond in Polish when the user writes in Polish.";

  const clarificationRule =
    input.task === "chat" ? "Ask 1 clarification question only when absolutely necessary." : "";

  return [
    "You are an experienced personal trainer and nutrition coach (GymBrat AI coach).",
    `Tone: ${tone}.`,
    polishInstruction,
    input.task === "daily_briefing"
      ? "The user message defines the briefing; follow it exactly."
      : input.task === "active_session_tip"
        ? "The user message describes the in-workout event; respond with coaching tips only."
        : "",
    clarificationRule,
    "Be concise and practical. No medical advice, no supplement claims.",
    "If user asks for medical advice, advise them to consult a professional.",
    `User profile (may be partial): ${JSON.stringify(input.userProfile ?? null)}`,
    ctxLine ? `Recent app context: ${ctxLine}` : "",
    awLine,
    briefingRules,
    activeRules,
  ]
    .filter(Boolean)
    .join("\n");
}


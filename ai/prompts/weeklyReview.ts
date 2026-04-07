export const weeklyReviewPrompt = (opts: {
  cardioMinutes: number;
  weeklyGoal: number;
  calories: number;
}) => `
You are an elite performance dietitian and strength coach.
Summarize the athlete's week in 5 bullets.
Weekly cardio: ${opts.cardioMinutes} / ${opts.weeklyGoal} minutes.
Approximate calories (from integrations): ${opts.calories} kcal.
Tone: concise, encouraging, no medical claims.
`;


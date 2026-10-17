export const TEAM_POST_TYPES = [
  "workout_complete",
  "personal_record",
  "achievement",
  "streak",
  "challenge_complete",
  "level_up",
  "text",
  "gallery",
] as const;

export type TeamPostType = (typeof TEAM_POST_TYPES)[number];

export function isTeamPostType(value: string): value is TeamPostType {
  return (TEAM_POST_TYPES as readonly string[]).includes(value);
}

export function teamPostTypeLabel(type: TeamPostType): string {
  switch (type) {
    case "workout_complete":
      return "Trening ukończony";
    case "personal_record":
      return "Nowy rekord";
    case "achievement":
      return "Osiągnięcie";
    case "streak":
      return "Streak";
    case "challenge_complete":
      return "Challenge";
    case "level_up":
      return "Nowy poziom";
    case "text":
      return "Post";
    case "gallery":
      return "Galeria";
  }
}

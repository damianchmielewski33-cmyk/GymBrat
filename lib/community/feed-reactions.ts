export const FEED_REACTIONS = [
  { kind: "beast", emoji: "🔥", label: "Beast" },
  { kind: "strong", emoji: "💪", label: "Strong" },
  { kind: "king", emoji: "👑", label: "King" },
  { kind: "monster", emoji: "⚡", label: "Monster" },
  { kind: "progress", emoji: "🚀", label: "Progress" },
  { kind: "insane", emoji: "😱", label: "Insane" },
] as const;

export type FeedReactionKind = (typeof FEED_REACTIONS)[number]["kind"];

export function isFeedReactionKind(value: string): value is FeedReactionKind {
  return FEED_REACTIONS.some((r) => r.kind === value);
}

export function feedReactionMeta(kind: FeedReactionKind) {
  return FEED_REACTIONS.find((r) => r.kind === kind)!;
}

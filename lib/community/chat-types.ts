export const CHAT_KINDS = ["team", "workout", "challenge"] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];

export const CHAT_QUICK_EMOJI = [
  "🔥",
  "💪",
  "👑",
  "⚡",
  "🚀",
  "😱",
  "😂",
  "❤️",
  "👍",
  "✅",
] as const;

export type ChatAuthor = {
  userId: string;
  displayName: string;
};

export type ChatReactionBucket = {
  emoji: string;
  count: number;
  me: boolean;
};

export type ChatMessageView = {
  id: string;
  channelId: string;
  body: string;
  author: ChatAuthor;
  parentMessageId: string | null;
  parentPreview: string | null;
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  reactions: ChatReactionBucket[];
  mentionUserIds: string[];
};

export type ChatChannelView = {
  id: string;
  kind: ChatKind;
  title: string;
  teamId: string | null;
  groupSessionId: string | null;
  challengeId: string | null;
  unreadCount: number;
};

export type ChatTypingUser = {
  userId: string;
  displayName: string;
};

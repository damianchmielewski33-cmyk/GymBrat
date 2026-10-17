export const NOTIFICATION_KINDS = [
  "comment",
  "reaction",
  "invite",
  "achievement",
  "challenge",
  "live",
  "ranking",
  "hall_of_fame",
  "team_announcement",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export function notificationKindLabel(kind: NotificationKind): string {
  switch (kind) {
    case "comment":
      return "Komentarze";
    case "reaction":
      return "Reakcje";
    case "invite":
      return "Zaproszenia";
    case "achievement":
      return "Osiągnięcia";
    case "challenge":
      return "Wyzwania";
    case "live":
      return "Live trening";
    case "ranking":
      return "Ranking";
    case "hall_of_fame":
      return "Hall of Fame";
    case "team_announcement":
      return "Ogłoszenia";
  }
}

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  teamId: string | null;
  entityType: string | null;
  entityId: string | null;
  groupKey: string | null;
  collapsedCount: number;
  createdAt: number;
  readAt: number | null;
  unread: boolean;
};

/** Okno grupowania nieprzeczytanych powiadomień (ms). */
export const NOTIFICATION_GROUP_WINDOW_MS = 2 * 60 * 60 * 1000;

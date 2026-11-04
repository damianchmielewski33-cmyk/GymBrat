import { z } from "zod";

/** Współdzielone (serwer + klient) stałe i walidacja zgłoszeń do wsparcia (Z50). */

/** Czas na odpowiedź na reklamację — zgodnie z regulaminem §8 i art. 7a ustawy o prawach konsumenta. */
export const SUPPORT_RESPONSE_DAYS = 14;

export const SUPPORT_KINDS = ["complaint", "question", "order", "other"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

export const SUPPORT_KIND_LABELS: Record<SupportKind, string> = {
  complaint: "Reklamacja",
  question: "Pytanie",
  order: "Płatność / zamówienie",
  other: "Inne",
};

export const SUPPORT_STATUSES = ["new", "in_progress", "resolved"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  new: "Nowe",
  in_progress: "W toku",
  resolved: "Zakończone",
};

export function isSupportStatus(v: unknown): v is SupportStatus {
  return typeof v === "string" && (SUPPORT_STATUSES as readonly string[]).includes(v);
}

export const supportRequestSchema = z.object({
  kind: z.enum(SUPPORT_KINDS),
  subject: z.string().trim().min(3, "Podaj temat (min. 3 znaki).").max(120),
  message: z.string().trim().min(10, "Opisz sprawę (min. 10 znaków).").max(4000),
  orderId: z.string().trim().max(64).optional().or(z.literal("")),
  contactEmail: z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(200).optional().or(z.literal("")),
});
export type SupportRequestInput = z.infer<typeof supportRequestSchema>;

export function supportDueAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SUPPORT_RESPONSE_DAYS * 24 * 60 * 60 * 1000);
}

export function supportDueLabel(due: Date | number): string {
  return new Date(due).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  });
}

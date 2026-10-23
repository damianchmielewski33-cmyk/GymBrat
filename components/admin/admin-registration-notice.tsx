"use client";

import type { ReactNode } from "react";
import { MailX, UserX } from "lucide-react";
import { AdminNotice } from "@/components/admin/admin-ui";
import {
  formatHostingFunctionCount,
  type ConfigIntegration,
  type ConfigSummary,
} from "@/lib/admin-config-status";

type RegistrationNoticeState =
  | { kind: "closed" }
  | { kind: "email-disabled"; providers: string };

/**
 * Stan rejestracji dla banera UX 001 5A (priorytet: 5A-1, potem 5A-2).
 * Flagi liczy serwer (`ConfigSummary`); dostawców bierzemy ze statusu integracji.
 */
export function registrationNoticeState(
  summary: Pick<ConfigSummary, "registrationBlocked" | "emailRegistrationMode">,
  integrations: Pick<ConfigIntegration, "id" | "status">[],
): RegistrationNoticeState | null {
  if (summary.registrationBlocked) return { kind: "closed" };
  if (summary.emailRegistrationMode !== "disabled") return null;
  const ok = (id: string) => integrations.some((i) => i.id === id && i.status === "ok");
  const google = ok("google");
  const facebook = ok("facebook");
  const providers =
    google && facebook ? "Google lub Facebook" : google ? "Google" : facebook ? "Facebook" : null;
  return providers ? { kind: "email-disabled", providers } : null;
}

/** Baner stanu rejestracji (UX 001, 5A-1 „Nikt nie może…”, 5A-2 „Rejestracja e-mailem…”). */
export function AdminRegistrationNotice({
  state,
  hostingIssues,
  action,
}: {
  state: RegistrationNoticeState;
  /** Łączna liczba braków konfiguracji (wymagane + zalecane). */
  hostingIssues: number;
  action: ReactNode;
}) {
  const closed = state.kind === "closed";
  const Icon = closed ? UserX : MailX;
  return (
    <AdminNotice tone={closed ? "danger" : "warn"} action={action}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {closed ? "Nikt nie może teraz założyć konta" : "Rejestracja e-mailem jest wyłączona"}
      </p>
      <p className="mt-1">
        {closed
          ? "Brak wysyłki e-mail (SMTP) i logowania przez Google lub Facebook. Istniejące konta logują się normalnie. Skonfiguruj SMTP albo Google na hostingu."
          : `Brak wysyłki e-mail (SMTP). Nowe konta można zakładać tylko przez ${state.providers}.`}
      </p>
      {hostingIssues > 1 ? (
        <p className="mt-1">
          Łącznie do skonfigurowania: {formatHostingFunctionCount(hostingIssues)}.
        </p>
      ) : null}
    </AdminNotice>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { setSensitiveConsentAction } from "@/actions/consents";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import { InlineBanner } from "@/components/ui/inline-banner";
import {
  SENSITIVE_CONSENT_COPY,
  type SensitiveConsentType,
} from "@/lib/consents-client";

/**
 * Okno zgody pokazywane, gdy serwer odmówił zapisu (`code: CONSENT_REQUIRED`).
 * Po zgodzie wywołuje `onGranted` — formularz ponawia zapis.
 */
export function ConsentRequiredDialog({
  type,
  onGranted,
  onCancel,
}: {
  type: SensitiveConsentType;
  onGranted: () => void;
  onCancel: () => void;
}) {
  const copy = SENSITIVE_CONSENT_COPY[type];
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function accept() {
    setError(null);
    start(async () => {
      const res = await setSensitiveConsentAction(type, true, "body_report");
      if (res.ok) onGranted();
      else setError(res.error);
    });
  }

  return (
    <AppDialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
      role="alertdialog"
      tone="gold"
      icon={ShieldCheck}
      title={copy.title}
      description={copy.body}
      overlayClassName="z-[1200]"
      className="z-[1201]"
    >
      {error ? (
        <InlineBanner variant="error" role="alert" className="mt-4 w-full text-left">
          {error}
        </InlineBanner>
      ) : null}
      <AppDialogActions>
        <AppDialogButton intent="primary" onClick={accept} disabled={pending}>
          {pending ? "Zapisuję…" : copy.cta}
        </AppDialogButton>
        <AppDialogButton onClick={onCancel} disabled={pending}>
          Nie teraz
        </AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}

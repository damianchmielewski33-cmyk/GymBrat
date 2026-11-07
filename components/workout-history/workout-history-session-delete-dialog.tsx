"use client";

import { Trash2 } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import { InlineBanner } from "@/components/ui/inline-banner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  dateLabel: string;
  pending: boolean;
  error: string | null;
  alreadyGone: boolean;
  onConfirm: () => void;
  onRetry: () => void;
};

/** Potwierdzenie usunięcia treningu z historii. */
export function WorkoutHistorySessionDeleteDialog({
  open,
  onOpenChange,
  label,
  dateLabel,
  pending,
  error,
  alreadyGone,
  onConfirm,
  onRetry,
}: Props) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={Trash2}
      title="Usunąć trening z historii?"
      description={`„${label}” z ${dateLabel} zniknie razem z seriami i tonażem. Plan treningowy się nie zmieni. Tego nie da się cofnąć.`}
    >
      {error ? (
        <InlineBanner variant="error" role="alert" className="mt-4 w-full text-left">
          {error}
          <button
            type="button"
            className="mt-2 block text-[13px] font-semibold text-white underline-offset-2 hover:underline"
            onClick={onRetry}
            disabled={pending}
          >
            Spróbuj ponownie
          </button>
        </InlineBanner>
      ) : null}
      {alreadyGone ? (
        <InlineBanner variant="info" role="status" className="mt-4 w-full text-left">
          Ten trening już nie istnieje. Odświeżyliśmy listę.
        </InlineBanner>
      ) : null}
      <AppDialogActions>
        <AppDialogButton
          intent="danger"
          disabled={pending || alreadyGone}
          aria-busy={pending}
          onClick={onConfirm}
        >
          {pending ? "Usuwam…" : "Usuń trening"}
        </AppDialogButton>
        <AppDialogButton disabled={pending} autoFocus onClick={() => onOpenChange(false)}>
          Anuluj
        </AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}

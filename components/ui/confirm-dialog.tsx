"use client";

import { Trash2 } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";

/** Potwierdzenie destrukcyjnej akcji (zamiast window.confirm). */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Usuń",
  cancelLabel = "Anuluj",
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={Trash2}
      title={title}
      description={description}
    >
      <AppDialogActions>
        <AppDialogButton
          intent="danger"
          disabled={pending}
          onClick={() => {
            onOpenChange(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </AppDialogButton>
        <AppDialogButton onClick={() => onOpenChange(false)}>{cancelLabel}</AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}

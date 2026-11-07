"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";

export const SAVE_FEEDBACK_DEFAULT = "Zapisano zmiany.";

type FeedbackPopup = {
  id: number;
  message: string;
  variant: "success" | "error";
};

type SaveFeedbackContextValue = {
  notifySaved: (message?: string) => void;
  notifyError: (message: string) => void;
};

const SaveFeedbackContext = createContext<SaveFeedbackContextValue | null>(null);

export function useSaveFeedback(): SaveFeedbackContextValue {
  const ctx = useContext(SaveFeedbackContext);
  if (!ctx) {
    throw new Error("useSaveFeedback must be used within SaveFeedbackProvider");
  }
  return ctx;
}

const AUTO_DISMISS_MS = 3200;
/** Błędy zostają dłużej, żeby dało się je przeczytać. */
const ERROR_DISMISS_MS = 6500;

function FeedbackPopupDialog({
  popup,
  onClose,
}: {
  popup: FeedbackPopup | null;
  onClose: () => void;
}) {
  const open = popup != null;
  const isSuccess = popup?.variant !== "error";

  const dismissMs = isSuccess ? AUTO_DISMISS_MS : ERROR_DISMISS_MS;

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(onClose, dismissMs);
    return () => window.clearTimeout(timer);
  }, [popup, onClose, dismissMs]);

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      tone={isSuccess ? "gold" : "danger"}
      icon={isSuccess ? CheckCircle2 : XCircle}
      title={isSuccess ? "Gotowe" : "Nie udało się"}
      description={popup?.message ?? ""}
      autoCloseMs={popup ? dismissMs : undefined}
    >
      <AppDialogActions>
        <AppDialogButton intent={isSuccess ? "primary" : "danger"} onClick={onClose}>
          {isSuccess ? "Super" : "Zamknij"}
        </AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}

export function SaveFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [popup, setPopup] = useState<FeedbackPopup | null>(null);
  const idRef = useRef(0);
  const lastToastRef = useRef<{ key: string; at: number } | null>(null);

  const close = useCallback(() => {
    setPopup(null);
  }, []);

  const pushPopup = useCallback((message: string, variant: "success" | "error") => {
    const key = `${variant}:${message}`;
    const now = Date.now();
    const last = lastToastRef.current;
    if (last && last.key === key && now - last.at < 1200) return;
    lastToastRef.current = { key, at: now };
    const id = ++idRef.current;
    setPopup({ id, message, variant });
  }, []);

  const notifySaved = useCallback(
    (message = SAVE_FEEDBACK_DEFAULT) => {
      pushPopup(message, "success");
    },
    [pushPopup],
  );

  const notifyError = useCallback(
    (message: string) => {
      pushPopup(message, "error");
    },
    [pushPopup],
  );

  const value = useMemo(
    () => ({ notifySaved, notifyError }),
    [notifySaved, notifyError],
  );

  return (
    <SaveFeedbackContext.Provider value={value}>
      {children}
      <FeedbackPopupDialog popup={popup} onClose={close} />
    </SaveFeedbackContext.Provider>
  );
}

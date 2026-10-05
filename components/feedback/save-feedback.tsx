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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function FeedbackPopupDialog({
  popup,
  onClose,
}: {
  popup: FeedbackPopup | null;
  onClose: () => void;
}) {
  const open = popup != null;
  const isSuccess = popup?.variant !== "error";

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [popup, onClose]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent className="app-dialog w-[min(92vw,380px)] p-0 text-white">
        <div className="relative overflow-hidden rounded-[22px] px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
          <div
            className={cn(
              "pointer-events-none absolute inset-0 opacity-90",
              isSuccess
                ? "bg-[radial-gradient(520px_220px_at_50%_-20%,rgba(235,196,74,0.22),transparent_60%)]"
                : "bg-[radial-gradient(520px_220px_at_50%_-20%,rgba(244,63,94,0.2),transparent_60%)]",
            )}
            aria-hidden
          />

          <div className="relative flex flex-col items-center text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border",
                isSuccess
                  ? "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                  : "border-rose-400/40 bg-rose-500/15 text-rose-300",
              )}
            >
              {isSuccess ? (
                <CheckCircle2 className="h-7 w-7" aria-hidden />
              ) : (
                <XCircle className="h-7 w-7" aria-hidden />
              )}
            </div>

            <AlertDialogTitle className="mt-4 text-lg font-semibold tracking-tight text-white">
              {isSuccess ? "Gotowe" : "Coś poszło nie tak"}
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-[15px] leading-relaxed text-white/70">
              {popup?.message ?? ""}
            </AlertDialogDescription>

            <Button
              type="button"
              className={cn(
                "mt-6 h-11 w-full rounded-full text-sm font-semibold",
                isSuccess ? "gold-btn" : "bg-rose-500/90 text-white hover:bg-rose-500",
              )}
              onClick={onClose}
            >
              OK
            </Button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
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

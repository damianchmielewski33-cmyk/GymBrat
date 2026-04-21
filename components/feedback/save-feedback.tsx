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
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const SAVE_FEEDBACK_DEFAULT = "Zapisano zmiany.";

type ToastItem = {
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

const DISMISS_MS = 4200;

function ToastBar({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.variant === "success";

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-[min(92vw,420px)] animate-in fade-in slide-in-from-bottom-3 duration-200 items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        isSuccess
          ? "border-emerald-500/30 bg-[#0a0c0f]/95 text-emerald-50"
          : "border-rose-500/35 bg-[#12080c]/95 text-rose-50",
      )}
      style={
        isSuccess
          ? {
              boxShadow:
                "0 0 0 1px rgba(16,185,129,0.15), 0 16px 48px rgba(0,0,0,0.55), 0 0 28px rgba(230,0,35,0.08)",
            }
          : {
              boxShadow:
                "0 0 0 1px rgba(251,113,133,0.2), 0 16px 48px rgba(0,0,0,0.55)",
            }
      }
      role="status"
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
      ) : (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/25 text-xs font-bold text-rose-100">
          !
        </span>
      )}
      <p className="min-w-0 flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
        aria-label="Zamknij komunikat"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[5000] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastBar key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

export function SaveFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notifySaved = useCallback((message = SAVE_FEEDBACK_DEFAULT) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, variant: "success" }]);
  }, []);

  const notifyError = useCallback((message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, variant: "error" }]);
  }, []);

  const value = useMemo(
    () => ({ notifySaved, notifyError }),
    [notifySaved, notifyError],
  );

  return (
    <SaveFeedbackContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </SaveFeedbackContext.Provider>
  );
}

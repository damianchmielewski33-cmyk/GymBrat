"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const POPUP_TEXT = "Zmieniamy się na lepsze";

type PopupCause = "console.error" | "window.error" | "unhandledrejection";

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function GlobalErrorPopupManager() {
  const [open, setOpen] = useState(false);
  const [cause, setCause] = useState<PopupCause | null>(null);
  const lastShownAtRef = useRef<number>(-Infinity);
  const queuedRef = useRef(false);

  const description = useMemo(() => {
    // Celowo bez technicznych szczegółów (wymóg: stała treść pop-upa).
    // Przyczynę trzymamy tylko po to, żeby unikać spamowania.
    return POPUP_TEXT;
  }, []);

  function requestPopup(nextCause: PopupCause) {
    const t = nowMs();
    // Prosta ochrona przed spamem (np. pętle logowania).
    if (open) return;
    if (queuedRef.current) return;
    if (t - lastShownAtRef.current < 2500) return;

    queuedRef.current = true;
    queueMicrotask(() => {
      queuedRef.current = false;
      lastShownAtRef.current = nowMs();
      setCause(nextCause);
      setOpen(true);
    });
  }

  useEffect(() => {
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      try {
        requestPopup("console.error");
      } catch {
        // never block logging
      }
      originalError(...args);
    };

    const onWindowError = () => requestPopup("window.error");
    const onUnhandled = () => requestPopup("unhandledrejection");
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandled);

    return () => {
      console.error = originalError;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogTitle>{POPUP_TEXT}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            OK
          </Button>
        </div>

        {cause ? (
          <p className="mt-3 text-[11px] text-white/30">
            Kod: {cause}
          </p>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}


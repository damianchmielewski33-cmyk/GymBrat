"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearStartPhotoAction,
  saveStartPhotoAction,
} from "@/actions/start-photo";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { fileToCompressedImageDataUrl } from "@/lib/client-image-data-url";
import { snapshotFiles } from "@/lib/file-snapshot";
import { cn } from "@/lib/utils";

/**
 * Otwiera galerię telefonu (input file) i zapisuje wybrane zdjęcie jako startowe.
 * Nakładka opacity-0 — działa w Android WebView.
 */
export function ChangeStartPhotoButton({
  hasCustomStart = false,
  className,
  label = "Zmień zdjęcie startowe",
}: {
  hasCustomStart?: boolean;
  className?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [reading, setReading] = useState(false);

  function onPick(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notifyError("Wybierz plik graficzny.");
      return;
    }
    setReading(true);
    start(async () => {
      try {
        const dataUrl = await fileToCompressedImageDataUrl(file);
        const r = await saveStartPhotoAction(dataUrl);
        if (!r.ok) {
          notifyError(r.error ?? "Nie udało się zapisać zdjęcia.");
          return;
        }
        notifySaved("Zapisano zdjęcie startowe.");
        router.refresh();
      } catch (err) {
        notifyError(
          err instanceof Error ? err.message : "Nie udało się wczytać zdjęcia.",
        );
      } finally {
        setReading(false);
      }
    });
  }

  function clearCustom() {
    start(async () => {
      const r = await clearStartPhotoAction();
      if (!r.ok) {
        notifyError(r.error ?? "Nie udało się przywrócić.");
        return;
      }
      notifySaved("Przywrócono zdjęcie z pierwszego raportu.");
      router.refresh();
    });
  }

  const busy = pending || reading;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative mx-auto flex w-full items-center justify-center py-1">
        <span
          className={cn(
            "pointer-events-none text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]",
            busy && "opacity-45",
          )}
        >
          {busy ? "Zapisuję…" : label}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={busy}
          aria-label={label}
          className={cn(
            "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0",
            busy && "pointer-events-none",
          )}
          onChange={(e) => {
            const input = e.currentTarget;
            const files = Array.from(input.files ?? []);
            if (files.length === 0) return;
            void snapshotFiles(files)
              .then(onPick)
              .catch(() => onPick(files))
              .finally(() => {
                input.value = "";
              });
          }}
        />
      </div>
      {hasCustomStart ? (
        <button
          type="button"
          disabled={busy}
          onClick={clearCustom}
          className="block w-full text-center text-[10px] font-medium uppercase tracking-[0.14em] text-white/40 hover:text-white/60 disabled:opacity-45"
        >
          Przywróć z raportów
        </button>
      ) : null}
    </div>
  );
}

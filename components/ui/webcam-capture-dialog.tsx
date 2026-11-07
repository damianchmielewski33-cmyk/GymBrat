"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, X } from "lucide-react";

/** Komputer z myszką i dostępną kamerą (telefon używa natywnego wyboru aparat/galeria). */
export function canUseWebcamCapture(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
}

/**
 * Podgląd z kamerki komputera + zrobienie zdjęcia. Zwraca plik JPEG;
 * przy braku zgody/kamery użytkownik wybiera plik z dysku.
 */
export function WebcamCaptureDialog({
  open,
  onClose,
  onCapture,
  onPickFile,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onPickFile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().then(() => !cancelled && setReady(true)).catch(() => setReady(true));
        }
      })
      .catch(() => {
        if (!cancelled) setError("Brak dostępu do kamery. Zezwól na kamerę w przeglądarce albo wybierz plik z dysku.");
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `zdjecie-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Zrób zdjęcie kamerą"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0b] p-4 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white/80 hover:text-white"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          {error ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">{error}</p>
          ) : (
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={snap}
            disabled={!ready || !!error}
            className="gym-btn-primary inline-flex h-11 items-center gap-2 rounded-2xl px-6 text-sm font-semibold disabled:opacity-50"
          >
            <Camera className="h-4 w-4" aria-hidden /> Zrób zdjęcie
          </button>
          <button
            type="button"
            onClick={onPickFile}
            className="gym-btn-outline inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm"
          >
            <ImageIcon className="h-4 w-4" aria-hidden /> Wybierz plik
          </button>
        </div>
      </div>
    </div>
  );
}

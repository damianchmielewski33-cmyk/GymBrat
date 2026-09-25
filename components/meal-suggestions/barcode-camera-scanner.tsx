"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ChevronLeft, Flashlight, FlashlightOff, Loader2, X } from "lucide-react";

type ZoomCaps = { min: number; max: number; step?: number };

function asZoomCaps(caps: MediaTrackCapabilities | undefined): ZoomCaps | null {
  const z = (caps as { zoom?: ZoomCaps } | undefined)?.zoom;
  if (!z || typeof z.min !== "number" || typeof z.max !== "number") return null;
  return z;
}

function supportsTorch(caps: MediaTrackCapabilities | undefined): boolean {
  return Boolean((caps as { torch?: boolean } | undefined)?.torch);
}

/**
 * Pełnoekranowy skaner EAN przez portal do body (nad paskiem nawigacji).
 * Podgląd aparatu edge-to-edge; sterowanie jako overlay.
 */
export function BarcodeCameraScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const handledRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    try {
      trackRef.current?.stop();
    } catch {
      /* ignore */
    }
    trackRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setTorchOn(false);
  }, []);

  const closeScanner = useCallback(() => {
    handledRef.current = true;
    stop();
    onCloseRef.current();
  }, [stop]);

  const setTorch = useCallback(async (on: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({
        // @ts-expect-error torch nie jest w standardowych typach DOM
        advanced: [{ torch: on }],
      });
      setTorchOn(on);
    } catch {
      setTorchAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      handledRef.current = false;
      setError(null);
      setManualCode("");
      setStarting(false);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let cancelled = false;
    handledRef.current = false;
    setStarting(true);
    setError(null);

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("To urządzenie nie udostępnia aparatu — wpisz kod EAN poniżej.");
          setStarting(false);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;

        if (track) {
          const caps = track.getCapabilities?.();
          const zoom = asZoomCaps(caps);
          if (zoom) {
            try {
              await track.applyConstraints({
                // @ts-expect-error zoom w advanced constraints
                advanced: [{ zoom: zoom.min }],
              });
            } catch {
              /* ignore */
            }
          }
          setTorchAvailable(supportsTorch(caps));
        }

        // Krótka pauza — portal musi zamontować <video> zanim podepniemy stream.
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          setError("Nie udało się przygotować podglądu aparatu.");
          setStarting(false);
          return;
        }

        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Android WebView czasem wymaga drugiego play() po metadanych.
          await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
              void video.play().finally(() => resolve());
            };
            setTimeout(() => resolve(), 800);
          });
        }
        if (cancelled) return;
        setStarting(false);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 600,
        });
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (cancelled || handledRef.current) return;
          if (!result) return;
          const text = result.getText()?.trim();
          if (!text) return;
          handledRef.current = true;
          try {
            navigator.vibrate?.(40);
          } catch {
            /* ignore */
          }
          stop();
          onDetectedRef.current(text.replace(/\s/g, ""));
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/NotAllowed|Permission|denied/i.test(msg)) {
          setError("Brak zgody na aparat. Zezwól na kamerę i spróbuj ponownie.");
        } else if (/NotFound|DevicesNotFound/i.test(msg)) {
          setError("Nie znaleziono kamery — wpisz kod EAN ręcznie.");
        } else {
          setError("Nie udało się uruchomić aparatu. Wpisz kod EAN poniżej.");
        }
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      stop();
    };
  }, [open, stop]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Skaner kodu kreskowego"
    >
      {/* Pełny kadr aparatu — viewport jak Fitatu: kwadrat + ciemna maska */}
      <div className="absolute inset-0 bg-[#1a1a1a]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          controls={false}
          disablePictureInPicture
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] h-[min(72vw,300px)] w-[min(72vw,300px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/70"
          style={{ boxShadow: "0 0 0 9999px rgba(26,26,26,0.88)" }}
        />
        <div className="pointer-events-none absolute left-1/2 top-[42%] h-[2px] w-[min(62vw,260px)] -translate-x-1/2 -translate-y-1/2 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.95)]" />
        {starting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            <Loader2 className="h-10 w-10 animate-spin text-white/85" />
            <p className="text-sm text-white/70">Uruchamiam aparat…</p>
          </div>
        ) : null}
      </div>

      {/* Górny pasek */}
      <div className="relative z-[1] flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Zamknij aparat"
          className="inline-flex h-11 items-center gap-1 rounded-full bg-black/50 px-3 text-white backdrop-blur-sm"
          onClick={closeScanner}
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="text-sm font-semibold">Wróć</span>
        </button>
        <button
          type="button"
          aria-label={torchOn ? "Wyłącz latarkę" : "Włącz latarkę"}
          disabled={!torchAvailable}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm disabled:opacity-30"
          onClick={() => void setTorch(!torchOn)}
        >
          {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
        </button>
      </div>

      <div className="relative z-[1] mt-auto space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-center text-sm text-white/80 drop-shadow">
          Umieść kod EAN w ramce. Potem ustawisz g / ml / szt.
        </p>
        {error ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-100">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Albo wpisz kod EAN"
            inputMode="numeric"
            className="h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-black/55 px-3 text-sm text-white outline-none backdrop-blur-sm placeholder:text-white/40"
          />
          <button
            type="button"
            disabled={!manualCode.trim()}
            className="h-12 shrink-0 rounded-xl bg-[var(--neon)] px-4 text-sm font-semibold text-black disabled:opacity-40"
            onClick={() => {
              const code = manualCode.replace(/\D/g, "");
              if (!code) return;
              handledRef.current = true;
              stop();
              onDetectedRef.current(code);
            }}
          >
            OK
          </button>
        </div>
        <button
          type="button"
          onClick={closeScanner}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-black/60 text-sm font-semibold text-white backdrop-blur-sm"
        >
          <X className="h-4 w-4" />
          Wyłącz aparat
        </button>
      </div>
    </div>,
    document.body,
  );
}

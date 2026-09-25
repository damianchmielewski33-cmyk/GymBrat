"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * Skaner etykiet: stabilna ramka, wyraźne Zamknij, szybsze formaty EAN/UPC.
 * onDetected trzymamy w ref — żeby nie restartować kamery przy każdym renderze rodzica.
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
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

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
            // Niższa rozdzielczość = szybszy dekoder, mniej „latania” przy autofokusie.
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            // @ts-expect-error focusMode w niektórych WebView
            focusMode: "continuous",
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

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
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
          delayBetweenScanAttempts: 80,
          delayBetweenScanSuccess: 800,
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
      stop();
    };
  }, [open, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0a0a0a] text-white">
      <div className="flex items-center justify-between px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Zamknij aparat"
          className="inline-flex h-11 items-center gap-1 rounded-full px-2 text-white/90"
          onClick={closeScanner}
        >
          <ChevronLeft className="h-7 w-7" />
          <span className="text-sm font-medium">Wróć</span>
        </button>
        <button
          type="button"
          aria-label={torchOn ? "Wyłącz latarkę" : "Włącz latarkę"}
          disabled={!torchAvailable}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/90 disabled:opacity-30"
          onClick={() => void setTorch(!torchOn)}
        >
          {torchOn ? <FlashlightOff className="h-6 w-6" /> : <Flashlight className="h-6 w-6" />}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        {/* Stały rozmiar ramki — object-cover wypełnia bez „latania” layoutu. */}
        <div
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-black"
          style={{ aspectRatio: "4 / 3", maxHeight: "min(52vh, 420px)" }}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover bg-black"
            playsInline
            muted
            autoPlay
          />
          <div className="pointer-events-none absolute inset-[12%] rounded-xl border border-white/50" />
          <div className="pointer-events-none absolute inset-x-[18%] top-1/2 h-[2px] -translate-y-1/2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          {starting ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white/80" />
            </div>
          ) : null}
        </div>
        <p className="mt-4 max-w-sm text-center text-sm text-white/55">
          Trzymaj kod w ramce — odczyt EAN. Potem ustawisz gramy, ml albo sztuki.
        </p>
        {error ? <p className="mt-2 max-w-sm text-center text-sm text-amber-200">{error}</p> : null}
      </div>

      <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Albo wpisz kod EAN"
            inputMode="numeric"
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            disabled={!manualCode.trim()}
            className="h-11 shrink-0 rounded-xl bg-[var(--neon)] px-4 text-sm font-semibold text-black disabled:opacity-40"
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
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] text-sm font-semibold text-white"
        >
          <X className="h-4 w-4" />
          Wyłącz aparat
        </button>
      </div>
    </div>
  );
}

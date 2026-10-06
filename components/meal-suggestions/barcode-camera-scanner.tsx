"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Flashlight, FlashlightOff, X } from "lucide-react";
import {
  ensureAndroidCameraPermission,
  isInstalledAndroidAppClient,
  openAndroidAppSettings,
} from "@/lib/app-webview";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type ZoomCaps = { min: number; max: number; step?: number };

/** idle → starting → ready | failed — błąd UI tylko przy `failed`. */
type CameraPhase = "idle" | "starting" | "ready" | "failed";

function asZoomCaps(caps: MediaTrackCapabilities | undefined): ZoomCaps | null {
  const z = (caps as { zoom?: ZoomCaps } | undefined)?.zoom;
  if (!z || typeof z.min !== "number" || typeof z.max !== "number") return null;
  return z;
}

function supportsTorch(caps: MediaTrackCapabilities | undefined): boolean {
  return Boolean((caps as { torch?: boolean } | undefined)?.torch);
}

function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  signal: { cancelled: boolean },
  attempts = 24,
): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    let left = attempts;
    const tick = () => {
      if (signal.cancelled) {
        resolve(null);
        return;
      }
      const el = getVideo();
      if (el) {
        resolve(el);
        return;
      }
      left -= 1;
      if (left <= 0) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Złote narożniki ramki skanu (jak na makiecie). */
function ScanCornerFrame({ className }: { className?: string }) {
  const arm = "absolute bg-[var(--gym-gold)]";
  const thick = "h-[3px] w-7 sm:w-8";
  const tall = "h-7 w-[3px] sm:h-8";
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      {/* TL */}
      <span className={cn(arm, thick, "left-0 top-0 rounded-full")} />
      <span className={cn(arm, tall, "left-0 top-0 rounded-full")} />
      {/* TR */}
      <span className={cn(arm, thick, "right-0 top-0 rounded-full")} />
      <span className={cn(arm, tall, "right-0 top-0 rounded-full")} />
      {/* BL */}
      <span className={cn(arm, thick, "bottom-0 left-0 rounded-full")} />
      <span className={cn(arm, tall, "bottom-0 left-0 rounded-full")} />
      {/* BR */}
      <span className={cn(arm, thick, "bottom-0 right-0 rounded-full")} />
      <span className={cn(arm, tall, "bottom-0 right-0 rounded-full")} />
    </div>
  );
}

/**
 * Pełnoekranowy skaner EAN — UI jak makieta: X / latarka, złote narożniki, dolny pasek.
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
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
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
    if (!open || !mounted) {
      if (!open) {
        stop();
        handledRef.current = false;
        setPhase("idle");
        setError(null);
        setManualCode("");
      }
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const signal = { cancelled: false };
    handledRef.current = false;
    setPhase("starting");
    setError(null);

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          if (signal.cancelled) return;
          setPhase("failed");
          setError("To urządzenie nie udostępnia aparatu — wpisz kod EAN poniżej.");
          return;
        }

        if (isInstalledAndroidAppClient()) {
          const granted = await ensureAndroidCameraPermission();
          if (signal.cancelled) return;
          if (!granted) {
            setPhase("failed");
            setError(
              "Brak zgody na aparat. Zezwól na kamerę w ustawieniach aplikacji i spróbuj ponownie.",
            );
            return;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
        });
        if (signal.cancelled) {
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
          if (!signal.cancelled) {
            setTorchAvailable(supportsTorch(caps));
          }
        }

        const video = await waitForVideoElement(() => videoRef.current, signal);
        if (signal.cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          setPhase("failed");
          setError("Nie udało się przygotować podglądu aparatu.");
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
          await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
              void video.play().finally(() => resolve());
            };
            setTimeout(() => resolve(), 800);
          });
        }
        if (signal.cancelled) return;

        setPhase("ready");
        setError(null);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 600,
        });
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (signal.cancelled || handledRef.current) return;
          if (!result) return;
          const text = result.getText()?.trim();
          if (!text) return;
          handledRef.current = true;
          hapticTap();
          stop();
          onDetectedRef.current(text.replace(/\s/g, ""));
        });
        if (signal.cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        if (signal.cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (/AbortError|aborted/i.test(msg)) return;
        setPhase("failed");
        if (/NotAllowed|Permission|denied/i.test(msg)) {
          setError("Brak zgody na aparat. Zezwól na kamerę i spróbuj ponownie.");
        } else if (/NotFound|DevicesNotFound/i.test(msg)) {
          setError("Nie znaleziono kamery — wpisz kod EAN ręcznie.");
        } else {
          setError("Nie udało się uruchomić aparatu. Wpisz kod EAN poniżej.");
        }
      }
    })();

    return () => {
      signal.cancelled = true;
      document.body.style.overflow = prevOverflow;
      stop();
    };
  }, [open, mounted, stop]);

  if (!open || !mounted) return null;

  const showError = phase === "failed" && error != null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Skaner kodu kreskowego"
    >
      <div className="absolute inset-0 bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          controls={false}
          disablePictureInPicture
        />
      </div>

      {/* Lekka winieta — bez pełnej maski, żeby kadr był widoczny jak na makiecie */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 42%, transparent 42%, rgba(0,0,0,0.45) 100%)",
        }}
        aria-hidden
      />

      {/* Ramka z złotymi narożnikami */}
      <div
        className="pointer-events-none absolute left-1/2 top-[44%] h-[min(68vw,280px)] w-[min(68vw,280px)] -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <ScanCornerFrame />
      </div>

      {/* Góra: X + latarka */}
      <div className="absolute inset-x-0 top-0 z-[1] flex items-center justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Zamknij skaner"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md"
          onClick={closeScanner}
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          aria-label={torchOn ? "Wyłącz latarkę" : "Włącz latarkę"}
          disabled={!torchAvailable && phase === "ready"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md disabled:opacity-35"
          onClick={() => void setTorch(!torchOn)}
        >
          {torchOn ? (
            <FlashlightOff className="h-5 w-5" />
          ) : (
            <Flashlight className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Dół: instrukcja (+ awaryjny wpis EAN tylko przy błędzie) */}
      <div className="absolute inset-x-0 bottom-0 z-[1] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-3 mb-2 rounded-2xl bg-black/72 px-4 py-4 text-center backdrop-blur-md sm:mx-5">
          {showError ? (
            <div className="space-y-3">
              <p className="text-[14px] leading-snug text-amber-100">{error}</p>
              {isInstalledAndroidAppClient() ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--gym-gold-bright)] underline underline-offset-2"
                  onClick={() => {
                    if (!openAndroidAppSettings()) {
                      setError(
                        "Otwórz Ustawienia → Aplikacje → GymBrat → Uprawnienia → Aparat.",
                      );
                    }
                  }}
                >
                  Otwórz ustawienia aplikacji
                </button>
              ) : null}
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Wpisz kod EAN"
                  inputMode="numeric"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/[0.06] px-3 text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="button"
                  disabled={!manualCode.trim()}
                  className="h-11 shrink-0 rounded-xl bg-[var(--gym-gold)] px-4 text-sm font-semibold text-black disabled:opacity-40"
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
            </div>
          ) : (
            <>
              <p className="text-[17px] font-semibold leading-snug text-white">
                {phase === "starting"
                  ? "Uruchamianie aparatu…"
                  : "Nakieruj na kod kreskowy"}
              </p>
              <p className="mt-1.5 text-[13px] leading-snug text-white/55">
                EAN-13 i EAN-8 z opakowań. Kod z wagi sklepowej nie zadziała.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

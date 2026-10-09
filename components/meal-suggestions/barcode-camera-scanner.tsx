"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatOneDReader } from "@zxing/browser";
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

/** idle → ready | failed — bez osobnego ekranu „uruchamianie”. */
type CameraPhase = "idle" | "ready" | "failed";

const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
] as const;

type NativeBarcodeDetector = {
  detect: (
    source: ImageBitmapSource,
  ) => Promise<Array<{ rawValue?: string | null }>>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => NativeBarcodeDetector;

function asZoomCaps(caps: MediaTrackCapabilities | undefined): ZoomCaps | null {
  const z = (caps as { zoom?: ZoomCaps } | undefined)?.zoom;
  if (!z || typeof z.min !== "number" || typeof z.max !== "number") return null;
  return z;
}

function supportsTorch(caps: MediaTrackCapabilities | undefined): boolean {
  return Boolean((caps as { torch?: boolean } | undefined)?.torch);
}

function supportsFocusMode(
  caps: MediaTrackCapabilities | undefined,
  mode: string,
): boolean {
  const modes = (caps as { focusMode?: string[] } | undefined)?.focusMode;
  return Array.isArray(modes) && modes.includes(mode);
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

function waitForVideoDimensions(
  video: HTMLVideoElement,
  signal: { cancelled: boolean },
  timeoutMs = 2500,
): Promise<boolean> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("loadedmetadata", onReady);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) done(true);
    };
    const timer = window.setTimeout(() => done(video.videoWidth > 0), timeoutMs);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("loadedmetadata", onReady);
    const poll = () => {
      if (signal.cancelled) {
        done(false);
        return;
      }
      if (video.videoWidth > 0) {
        done(true);
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

async function createNativeDetector(): Promise<NativeBarcodeDetector | null> {
  const Ctor = (
    globalThis as typeof globalThis & { BarcodeDetector?: BarcodeDetectorCtor }
  ).BarcodeDetector;
  if (typeof Ctor !== "function") return null;

  const preferred = [...NATIVE_FORMATS];
  try {
    const getFormats = (
      Ctor as unknown as {
        getSupportedFormats?: () => Promise<string[]>;
      }
    ).getSupportedFormats;
    if (typeof getFormats === "function") {
      const supported = await getFormats.call(Ctor);
      const usable = preferred.filter((f) => supported.includes(f));
      if (usable.length === 0) return null;
      return new Ctor({ formats: usable });
    }
    return new Ctor({ formats: preferred });
  } catch {
    return null;
  }
}

/**
 * Wycina szeroki pas środka kadru (EAN jest poziomy) i lekko powiększa do dekodera.
 * Mniejszy ROI = szybszy i pewniejszy odczyt niż cały frame.
 */
function drawScanRoi(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw < 16 || vh < 16) return null;

  const roiW = Math.floor(vw * 0.92);
  const roiH = Math.floor(Math.min(vh * 0.42, roiW * 0.45));
  const sx = Math.floor((vw - roiW) / 2);
  const sy = Math.floor((vh - roiH) / 2);

  // Skaluj do stałej szerokości — ZXing lepiej czyta ~720–960 px niż 4K.
  const targetW = Math.min(960, Math.max(640, roiW));
  const targetH = Math.max(160, Math.round((roiH / roiW) * targetW));

  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, roiW, roiH, 0, 0, targetW, targetH);
  return canvas;
}

function normalizeBarcodeText(raw: string): string {
  return raw.replace(/\s/g, "").trim();
}

function looksLikeProductBarcode(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false;
  // EAN-8 / UPC-E / EAN-13 / UPC-A (+ ewentualne wiodące 0)
  return code.length === 8 || code.length === 12 || code.length === 13 || code.length === 14;
}

/** Preferuj zoom ~1.5–2× zamiast ultra-szerokiego min (częsta przyczyna „nie wykrywa”). */
function preferredZoom(zoom: ZoomCaps): number {
  const target = 1.75;
  if (zoom.max <= zoom.min) return zoom.min;
  if (target <= zoom.min) return zoom.min;
  if (target >= zoom.max) return zoom.max;
  const step = typeof zoom.step === "number" && zoom.step > 0 ? zoom.step : 0.1;
  const steps = Math.round((target - zoom.min) / step);
  return Math.min(zoom.max, zoom.min + steps * step);
}

/** Złote narożniki ramki skanu (jak na makiecie). */
function ScanCornerFrame({ className }: { className?: string }) {
  const arm = "absolute bg-[var(--gym-gold)]";
  const thick = "h-[3px] w-8 sm:w-10";
  const tall = "h-7 w-[3px] sm:h-8";
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <span className={cn(arm, thick, "left-0 top-0 rounded-full")} />
      <span className={cn(arm, tall, "left-0 top-0 rounded-full")} />
      <span className={cn(arm, thick, "right-0 top-0 rounded-full")} />
      <span className={cn(arm, tall, "right-0 top-0 rounded-full")} />
      <span className={cn(arm, thick, "bottom-0 left-0 rounded-full")} />
      <span className={cn(arm, tall, "bottom-0 left-0 rounded-full")} />
      <span className={cn(arm, thick, "bottom-0 right-0 rounded-full")} />
      <span className={cn(arm, tall, "bottom-0 right-0 rounded-full")} />
    </div>
  );
}

/**
 * Pełnoekranowy skaner EAN — UI jak makieta: X / latarka, złote narożniki, dolny pasek.
 * Preferuje natywne BarcodeDetector (Android/Chrome), ZXing jako fallback; skanuje ROI środka.
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
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scanTimerRef = useRef<number | null>(null);
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
    if (scanTimerRef.current != null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
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
    setError(null);
    setTorchAvailable(false);

    const acceptCode = (raw: string) => {
      if (signal.cancelled || handledRef.current) return;
      const text = normalizeBarcodeText(raw);
      if (!text || !looksLikeProductBarcode(text)) return;
      handledRef.current = true;
      hapticTap();
      stop();
      onDetectedRef.current(text);
    };

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          if (signal.cancelled) return;
          setPhase("failed");
          setError("To urządzenie nie udostępnia aparatu — wpisz kod EAN poniżej.");
          return;
        }

        const videoReady = waitForVideoElement(() => videoRef.current, signal);

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
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // @ts-expect-error focusMode w constraints niektórych przeglądarek
            focusMode: { ideal: "continuous" },
          },
        });
        if (signal.cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;

        const video = await videoReady;
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

        const playPromise = video.play().catch(
          () =>
            new Promise<void>((resolve) => {
              const done = () => resolve();
              video.addEventListener(
                "loadedmetadata",
                () => {
                  void video.play().finally(done);
                },
                { once: true },
              );
              window.setTimeout(done, 400);
            }),
        );
        await playPromise;
        if (signal.cancelled) return;

        await waitForVideoDimensions(video, signal);
        if (signal.cancelled) return;

        setPhase("ready");
        setError(null);

        if (track) {
          const caps = track.getCapabilities?.();
          if (!signal.cancelled) {
            setTorchAvailable(supportsTorch(caps));
          }

          const advanced: Record<string, unknown>[] = [];
          if (supportsFocusMode(caps, "continuous")) {
            advanced.push({ focusMode: "continuous" });
          }
          const zoom = asZoomCaps(caps);
          if (zoom) {
            advanced.push({ zoom: preferredZoom(zoom) });
          }
          if (advanced.length > 0) {
            void track
              .applyConstraints({
                // @ts-expect-error advanced constraints (zoom / focusMode)
                advanced,
              })
              .catch(() => {
                /* ignore */
              });
          }
        }

        const roiCanvas = document.createElement("canvas");
        const nativeDetector = await createNativeDetector();

        // Szybki reader 1D (EAN/UPC) + osobny z TRY_HARDER co kilka klatek.
        const baseHints = new Map<DecodeHintType, unknown>();
        baseHints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        const hardHints = new Map(baseHints);
        hardHints.set(DecodeHintType.TRY_HARDER, true);

        const zxingFast = new BrowserMultiFormatOneDReader(baseHints, {
          delayBetweenScanAttempts: 0,
          delayBetweenScanSuccess: 0,
        });
        const zxingHard = new BrowserMultiFormatOneDReader(hardHints, {
          delayBetweenScanAttempts: 0,
          delayBetweenScanSuccess: 0,
        });

        let frame = 0;
        const tick = async () => {
          if (signal.cancelled || handledRef.current) return;

          const started = performance.now();
          try {
            const canvas = drawScanRoi(video, roiCanvas);
            if (canvas) {
              if (nativeDetector) {
                const codes = await nativeDetector.detect(canvas);
                const raw = codes.find((c) => c.rawValue)?.rawValue;
                if (raw) {
                  acceptCode(raw);
                  return;
                }
                // Co 3. klatka: ZXing dogania gdy native pominie trudniejszy EAN.
                if (frame % 3 === 0) {
                  try {
                    const result = zxingHard.decodeFromCanvas(canvas);
                    const text = result.getText();
                    if (text) {
                      acceptCode(text);
                      return;
                    }
                  } catch {
                    /* brak kodu */
                  }
                }
              } else {
                const reader = frame % 3 === 2 ? zxingHard : zxingFast;
                try {
                  const result = reader.decodeFromCanvas(canvas);
                  const text = result.getText();
                  if (text) {
                    acceptCode(text);
                    return;
                  }
                } catch {
                  /* brak kodu w tej klatce */
                }
              }
            }
          } catch {
            /* ignore pojedynczej klatki */
          }

          frame += 1;
          if (signal.cancelled || handledRef.current) return;
          const elapsed = performance.now() - started;
          // ~12–18 fps: dość często, bez dławienia UI na słabszych telefonach.
          const delay = Math.max(35, 65 - elapsed);
          scanTimerRef.current = window.setTimeout(() => {
            void tick();
          }, delay);
        };

        void tick();
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

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 78% 48% at 50% 42%, transparent 38%, rgba(0,0,0,0.5) 100%)",
        }}
        aria-hidden
      />

      {/* Szeroka ramka pod kody EAN (poziome), łatwiejsze celowanie */}
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[min(34vw,150px)] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <ScanCornerFrame />
      </div>

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
          disabled={!torchAvailable || phase !== "ready"}
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
                Nakieruj na kod kreskowy
              </p>
              <p className="mt-1.5 text-[13px] leading-snug text-white/55">
                Trzymaj kod w złotej ramce, blisko i w dobrym świetle. EAN z
                opakowań — kod z wagi sklepowej nie zadziała.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

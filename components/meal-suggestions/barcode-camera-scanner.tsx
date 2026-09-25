"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, X } from "lucide-react";

/**
 * Pełny podgląd kamery + odczyt EAN z etykiety (ZXing).
 * Działa w Chrome/Android i jako fallback gdy brak BarcodeDetector.
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
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [starting, setStarting] = useState(false);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      handledRef.current = false;
      setError(null);
      setManualCode("");
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

        // Prośba o kamerę tylną (etykieta produktu).
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
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
        setStarting(false);

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(video, (result, err) => {
          if (cancelled || handledRef.current) return;
          if (result) {
            const text = result.getText()?.trim();
            if (!text) return;
            handledRef.current = true;
            try {
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.(40);
              }
            } catch {
              /* ignore */
            }
            stop();
            onDetected(text.replace(/\s/g, ""));
            return;
          }
          // NotFoundException i inne „puste” klatki — ignorujemy
          if (err && err.name && !/NotFoundException/i.test(err.name)) {
            /* ciche — ciągły skan */
          }
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/NotAllowed|Permission|denied/i.test(msg)) {
          setError("Brak zgody na aparat. Zezwól na kamerę w ustawieniach przeglądarki / aplikacji i spróbuj ponownie.");
        } else if (/NotFound|DevicesNotFound/i.test(msg)) {
          setError("Nie znaleziono kamery na tym urządzeniu — wpisz kod EAN ręcznie.");
        } else {
          setError("Nie udało się uruchomić aparatu. Wpisz kod EAN z etykiety poniżej.");
        }
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onDetected, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
            Skan etykiety
          </p>
          <p className="truncate text-base font-semibold text-white">
            Skieruj aparat na kod kreskowy
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-white/20 bg-white/10"
          onClick={() => {
            stop();
            onClose();
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Zamknij
        </Button>
      </div>

      <div className="relative mx-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-36 w-[78%] rounded-2xl border-2 border-[var(--neon)]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/85">
          {starting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uruchamiam aparat…
            </>
          ) : (
            <>
              <Camera className="h-3.5 w-3.5" />
              Szukam kodu EAN…
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <p className="text-center text-sm text-white/55">
          Po odczycie kodu makro (białko, węgle, tłuszcz) trafi do dziennika diety.
        </p>
        {error ? <p className="text-center text-sm text-amber-200">{error}</p> : null}
        <div className="flex gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Albo wpisz kod EAN z etykiety"
            inputMode="numeric"
            className="bg-white/5"
          />
          <Button
            type="button"
            variant="cta"
            disabled={!manualCode.trim()}
            onClick={() => {
              const code = manualCode.replace(/\D/g, "");
              if (!code) return;
              handledRef.current = true;
              stop();
              onDetected(code);
            }}
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

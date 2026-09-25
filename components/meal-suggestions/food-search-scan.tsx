"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  lookupFoodByBarcodeAction,
  searchFoodProductsAction,
} from "@/actions/food-lookup";
import type { FoodProduct } from "@/lib/food-products-types";
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { DIET_DIARY_SLOT_LABELS } from "@/lib/diet-diary-slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { useActionState } from "react";
import { Camera, Loader2, ScanBarcode, Search, X } from "lucide-react";

function MacroPill({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
        {Math.round(value * 10) / 10}
        <span className="ml-0.5 text-[10px] font-normal text-white/40">{unit}</span>
      </p>
    </div>
  );
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector():
  | (new (opts?: { formats?: string[] }) => BarcodeDetectorLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector ?? null;
}

export function FoodSearchScan({
  dateKey,
  defaultSlot,
  initialOpen = false,
  lockedSlot,
  onAdded,
}: {
  dateKey: string;
  defaultSlot: DietDiarySlot;
  initialOpen?: boolean;
  /** Gdy ustawione — dodajemy zawsze do tej sekcji (przycisk z sekcji). */
  lockedSlot?: DietDiarySlot;
  onAdded?: () => void;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<FoodProduct | null>(null);
  const [slot, setSlot] = useState<DietDiarySlot>(lockedSlot ?? defaultSlot);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [addState, formAction] = useActionState(addMealLogAction, {} as MealLogFormState);

  useEffect(() => {
    if (lockedSlot) setSlot(lockedSlot);
  }, [lockedSlot]);

  useEffect(() => {
    if (initialOpen) {
      start(async () => {
        const r = await searchFoodProductsAction("");
        if (r.ok) setProducts(r.products);
      });
    }
  }, [initialOpen]);

  useEffect(() => {
    if (addState?.ok) {
      notifySaved("Dodano do dziennika.");
      setSelected(null);
      onAdded?.();
    } else if (addState?.error) {
      notifyError(addState.error);
    }
  }, [addState, notifyError, notifySaved, onAdded]);

  const runSearch = useCallback(
    (q: string) => {
      start(async () => {
        const r = await searchFoodProductsAction(q);
        if (!r.ok) {
          notifyError(r.error);
          return;
        }
        setProducts(r.products);
      });
    },
    [notifyError],
  );

  const stopScan = useCallback(() => {
    if (scanTimerRef.current != null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!scanOpen) {
      stopScan();
      return;
    }

    let cancelled = false;
    setScanError(null);

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setScanError("Ta przeglądarka nie obsługuje kamery — wpisz kod ręcznie.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        const Detector = getBarcodeDetector();
        if (!Detector) {
          setScanError(
            "Automatyczny odczyt kodu niedostępny na tym urządzeniu — wpisz kod EAN poniżej.",
          );
          return;
        }
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
        });
        scanTimerRef.current = window.setInterval(() => {
          const v = videoRef.current;
          if (!v || v.readyState < 2) return;
          void detector.detect(v).then((codes) => {
            const raw = codes[0]?.rawValue?.trim();
            if (!raw) return;
            stopScan();
            setScanOpen(false);
            start(async () => {
              const r = await lookupFoodByBarcodeAction(raw);
              if (!r.ok) {
                notifyError(r.error);
                setManualCode(raw);
                return;
              }
              setSelected(r.product);
              setProducts([r.product]);
            });
          });
        }, 500);
      } catch {
        setScanError("Brak dostępu do kamery. Wpisz kod kreskowy ręcznie.");
      }
    })();

    return () => {
      cancelled = true;
      stopScan();
    };
  }, [scanOpen, stopScan, notifyError]);

  function submitManualCode() {
    const code = manualCode.trim();
    if (!code) return;
    start(async () => {
      const r = await lookupFoodByBarcodeAction(code);
      if (!r.ok) {
        notifyError(r.error);
        return;
      }
      setSelected(r.product);
      setProducts([r.product]);
      setScanOpen(false);
    });
  }

  return (
    <section className="app-card space-y-4 p-5">
      <div>
        <p className="app-label">Baza produktów</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Szukaj lub skanuj</h2>
        <p className="mt-1 text-sm text-white/55">
          Wpisz nazwę albo zeskanuj kod kreskowy — zobaczysz białko, węgle, tłuszcz i kcal, potem
          dodasz produkt do sekcji posiłku.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(query);
              }
            }}
            placeholder="Np. jogurt, kurczak, 590…"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="cta" disabled={pending} onClick={() => runSearch(query)}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Szukaj"}
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-label="Skanuj kod kreskowy"
          onClick={() => setScanOpen(true)}
        >
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>

      {products.length > 0 ? (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{p.name}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {[p.brand, p.servingLabel, p.barcode ? `EAN ${p.barcode}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                  {Math.round(p.proteinG)}B · {Math.round(p.carbsG)}W · {Math.round(p.fatG)}T
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/40">
          Wyszukaj produkt z bazy albo zeskanuj opakowanie, żeby zobaczyć makro.
        </p>
      )}

      <Sheet open={scanOpen} onOpenChange={setScanOpen}>
        <SheetContent side="bottom" className="border-white/10 bg-[#07070c] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Skan kodu kreskowego</SheetTitle>
            <SheetDescription className="text-white/55">
              Skieruj kamerę na EAN produktu. Możesz też wpisać kod ręcznie.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-28 w-[70%] rounded-xl border-2 border-[var(--neon)]/70" />
              </div>
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/80">
                <Camera className="h-3.5 w-3.5" />
                Skanowanie…
              </div>
            </div>
            {scanError ? <p className="text-sm text-amber-200">{scanError}</p> : null}
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Wpisz kod EAN"
                inputMode="numeric"
              />
              <Button type="button" variant="cta" disabled={pending} onClick={submitManualCode}>
                OK
              </Button>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => setScanOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Zamknij
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="bottom" className="border-white/10 bg-[#07070c] text-white">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{selected.name}</SheetTitle>
                <SheetDescription className="text-white/55">
                  {[selected.brand, selected.servingLabel].filter(Boolean).join(" · ")}
                  {selected.source === "openfoodfacts" ? " · Open Food Facts" : " · baza GymBrat"}
                </SheetDescription>
              </SheetHeader>
              <form action={formAction} className="space-y-4 px-4 pb-6">
                <input type="hidden" name="date" value={dateKey} />
                <input type="hidden" name="name" value={selected.name} />
                <input type="hidden" name="slot" value={slot} />
                <input type="hidden" name="barcode" value={selected.barcode ?? ""} />
                <input type="hidden" name="proteinG" value={String(selected.proteinG)} />
                <input type="hidden" name="fatG" value={String(selected.fatG)} />
                <input type="hidden" name="carbsG" value={String(selected.carbsG)} />
                <input type="hidden" name="calories" value={String(selected.calories)} />

                <div className="grid grid-cols-4 gap-2">
                  <MacroPill label="Kcal" value={selected.calories} unit="" />
                  <MacroPill label="Białko" value={selected.proteinG} unit="g" />
                  <MacroPill label="Węgle" value={selected.carbsG} unit="g" />
                  <MacroPill label="Tłuszcz" value={selected.fatG} unit="g" />
                </div>

                {!lockedSlot ? (
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(DIET_DIARY_SLOT_LABELS) as DietDiarySlot[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlot(s)}
                        className={
                          slot === s
                            ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                            : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70"
                        }
                      >
                        {DIET_DIARY_SLOT_LABELS[s]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/55">
                    Sekcja: <span className="text-white">{DIET_DIARY_SLOT_LABELS[slot]}</span>
                  </p>
                )}

                <SheetFooter className="flex flex-row gap-2 px-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelected(null)}
                  >
                    Anuluj
                  </Button>
                  <Button type="submit" variant="cta" className="flex-[1.2]">
                    Dodaj do {DIET_DIARY_SLOT_LABELS[slot]}
                  </Button>
                </SheetFooter>
              </form>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

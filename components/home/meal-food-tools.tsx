"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode, Search, Sparkles } from "lucide-react";
import { searchFoodCatalog, type FoodCatalogItem } from "@/lib/food-catalog";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MealFillValues = {
  name: string;
  protein: string;
  fat: string;
  carbs: string;
  kcal: string;
};

type MealFoodToolsProps = {
  onFill: (values: MealFillValues) => void;
};

export function MealFoodTools({ onFill }: MealFoodToolsProps) {
  const [tab, setTab] = useState<"catalog" | "barcode" | "ocr">("catalog");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FoodCatalogItem[]>(() => searchFoodCatalog("", 8));
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanActive, setScanActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setHits(searchFoodCatalog(query, 10));
  }, [query]);

  const stopScan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanActive(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  function applyItem(item: {
    name: string;
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  }) {
    onFill({
      name: item.name,
      protein: String(item.proteinG),
      fat: String(item.fatG),
      carbs: String(item.carbsG),
      kcal: String(item.kcal),
    });
  }

  async function lookupBarcode(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/food/barcode?barcode=${encodeURIComponent(code)}`,
        { credentials: "include" },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        product?: {
          name: string;
          brand?: string;
          kcal: number;
          proteinG: number;
          fatG: number;
          carbsG: number;
        };
      };
      if (!res.ok || !data.ok || !data.product) {
        setError(data.error || "Nie znaleziono produktu");
        return;
      }
      const p = data.product;
      applyItem({
        name: p.brand ? `${p.name} (${p.brand})` : p.name,
        kcal: p.kcal,
        proteinG: p.proteinG,
        fatG: p.fatG,
        carbsG: p.carbsG,
      });
      stopScan();
    } catch {
      setError("Błąd sieci przy skanie");
    } finally {
      setBusy(false);
    }
  }

  async function startScan() {
    setError(null);
    if (!("BarcodeDetector" in window)) {
      setError("Ta przeglądarka nie obsługuje skanera — wpisz kod ręcznie.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScanActive(true);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-expect-error BarcodeDetector is not in all TS libs
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
      });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes?.[0]?.rawValue;
          if (raw) {
            setBarcode(String(raw));
            await lookupBarcode(String(raw));
            return;
          }
        } catch {
          /* ignore frame errors */
        }
        if (streamRef.current) requestAnimationFrame(() => void tick());
      };
      requestAnimationFrame(() => void tick());
    } catch {
      setError("Brak dostępu do kamery. Wpisz kod ręcznie lub zezwól na kamerę.");
      stopScan();
    }
  }

  async function runOcr(file: File) {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      await ensureCsrfCookie();
      const res = await fetch("/api/food/ocr-label", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        label?: {
          name?: string;
          kcal?: number;
          proteinG?: number;
          fatG?: number;
          carbsG?: number;
        };
      };
      if (!res.ok || !data.ok || !data.label) {
        setError(data.error || "OCR nie odczytał etykiety");
        return;
      }
      const l = data.label;
      applyItem({
        name: l.name?.trim() || "Produkt z etykiety",
        kcal: l.kcal ?? 0,
        proteinG: l.proteinG ?? 0,
        fatG: l.fatG ?? 0,
        carbsG: l.carbsG ?? 0,
      });
    } catch {
      setError("Błąd OCR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["catalog", "Katalog", Search],
            ["barcode", "Kod kreskowy", ScanBarcode],
            ["ocr", "Etykieta OCR", Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setError(null);
              if (id !== "barcode") stopScan();
            }}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${
              tab === id
                ? "border-[var(--neon)]/40 bg-[var(--neon)]/15 text-white"
                : "border-white/10 text-white/60"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {tab === "catalog" ? (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj: kurczak, ryż, owsianka…"
            className="h-10 border-white/15 bg-black/30 text-white"
          />
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => applyItem(h)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-white/85 hover:bg-white/5"
                >
                  <span className="min-w-0 truncate">
                    {h.name}
                    {h.portionLabel ? (
                      <span className="text-white/40"> · {h.portionLabel}</span>
                    ) : (
                      <span className="text-white/40"> · /100 g</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/50">{h.kcal} kcal</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "barcode" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="EAN / UPC"
              className="h-10 border-white/15 bg-black/30 text-white"
            />
            <Button
              type="button"
              disabled={busy || barcode.trim().length < 8}
              onClick={() => void lookupBarcode(barcode.trim())}
            >
              Szukaj
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void startScan()}>
              <Camera className="mr-1.5 h-4 w-4" />
              Skanuj kamerą
            </Button>
            {scanActive ? (
              <Button type="button" variant="outline" onClick={stopScan}>
                Stop
              </Button>
            ) : null}
          </div>
          {scanActive ? (
            <video
              ref={videoRef}
              muted
              playsInline
              className="mt-2 h-40 w-full rounded-lg object-cover"
            />
          ) : null}
          <p className="text-[11px] text-white/40">
            Dane z Open Food Facts (na 100 g). Sprawdź porcję przed zapisem.
          </p>
        </div>
      ) : null}

      {tab === "ocr" ? (
        <div className="space-y-2">
          <Label htmlFor="ocr-file" className="text-xs text-white/55">
            Zdjęcie tabeli wartości odżywczych
          </Label>
          <Input
            id="ocr-file"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runOcr(f);
            }}
            className="h-10 border-white/15 bg-black/30 text-white file:text-white"
          />
          <p className="text-[11px] text-white/40">
            Wymaga włączonego AI (vision). Wynik zawsze możesz poprawić ręcznie.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

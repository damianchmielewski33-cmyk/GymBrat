"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BodyReportFormProps = {
  maxPhotos?: number;
};

type Scores = {
  trainingEnergy: number;
  sleepQuality: number;
  dayEnergy: number;
  digestionScore: number;
};

async function fileToResizedDataUrl(
  file: File,
  opts: { maxSide: number; quality: number },
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const max = Math.max(width, height);
  const scale = max > opts.maxSide ? opts.maxSide / max : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak canvas context");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", opts.quality);
  return dataUrl;
}

export function BodyReportForm({ maxPhotos = 8 }: BodyReportFormProps) {
  const router = useRouter();
  const { notifySaved } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  const [weightKg, setWeightKg] = useState<string>("");
  const [waistCm, setWaistCm] = useState<string>("");
  const [chestCm, setChestCm] = useState<string>("");
  const [thighCm, setThighCm] = useState<string>("");
  const [scores, setScores] = useState<Scores>({
    trainingEnergy: 6,
    sleepQuality: 6,
    dayEnergy: 6,
    digestionScore: 6,
  });
  const [cardioCompliance, setCardioCompliance] = useState<string>("");
  const [dietCompliance, setDietCompliance] = useState<string>("");
  const [trainingCompliance, setTrainingCompliance] = useState<string>("");
  const [complianceNotes, setComplianceNotes] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const canAddMorePhotos = photos.length < maxPhotos;
  const photosHint = useMemo(() => `${photos.length} / ${maxPhotos}`, [photos.length, maxPhotos]);

  return (
    <div className="glass-panel neon-glow overflow-hidden">
      {!isOpen ? (
        <div className="flex flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Nowy raport
            </p>
            <p className="mt-1 text-sm text-white/65">
              Dodaj raport z efektów ćwiczeń: pomiary, samopoczucie i zdjęcia sylwetki.
            </p>
          </div>
          <Button
            type="button"
            className="h-11 bg-[var(--neon)] text-base font-semibold text-white hover:bg-[#ff4d6d]"
            onClick={() => setIsOpen(true)}
          >
            Dodaj Raport
          </Button>
        </div>
      ) : (
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
                Nowy raport
              </p>
              <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                Dodaj raport z efektów
              </h2>
              <p className="mt-1 text-xs text-white/55">
                Waga, wymiary, samopoczucie oraz zdjęcia sylwetki.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-10 justify-start text-white/75 hover:bg-white/10 hover:text-white sm:justify-center"
              onClick={() => setIsOpen(false)}
            >
              Anuluj
            </Button>
          </div>
        </div>
      )}

      <form
        className={isOpen ? "space-y-6 p-6" : "hidden"}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              const res = await fetch("/api/body-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  weightKg: weightKg ? Number(weightKg) : null,
                  waistCm: waistCm ? Number(waistCm) : null,
                  chestCm: chestCm ? Number(chestCm) : null,
                  thighCm: thighCm ? Number(thighCm) : null,
                  trainingEnergy: scores.trainingEnergy,
                  sleepQuality: scores.sleepQuality,
                  dayEnergy: scores.dayEnergy,
                  digestionScore: scores.digestionScore,
                  cardioCompliance: cardioCompliance || null,
                  dietCompliance: dietCompliance || null,
                  trainingCompliance: trainingCompliance || null,
                  complianceNotes: complianceNotes.trim() || null,
                  additionalInfo: additionalInfo.trim() || null,
                  photoDataUrls: photos,
                }),
              });
              const json = (await res.json()) as { ok: boolean; error?: string };
              if (!json.ok) {
                setError(json.error ?? "Nie udało się zapisać raportu.");
                return;
              }
              notifySaved("Zapisano raport.");
              setWeightKg("");
              setWaistCm("");
              setChestCm("");
              setThighCm("");
              setScores({
                trainingEnergy: 6,
                sleepQuality: 6,
                dayEnergy: 6,
                digestionScore: 6,
              });
              setCardioCompliance("");
              setDietCompliance("");
              setTrainingCompliance("");
              setComplianceNotes("");
              setAdditionalInfo("");
              setPhotos([]);
              setIsOpen(false);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Nieznany błąd");
            }
          });
        }}
      >
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="weightKg">Waga (kg)</Label>
            <Input
              id="weightKg"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="np. 82.4"
              className="h-10 border-white/15 bg-black/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waistCm">Pas (cm)</Label>
            <Input
              id="waistCm"
              inputMode="decimal"
              value={waistCm}
              onChange={(e) => setWaistCm(e.target.value)}
              placeholder="np. 84"
              className="h-10 border-white/15 bg-black/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chestCm">Klatka (cm)</Label>
            <Input
              id="chestCm"
              inputMode="decimal"
              value={chestCm}
              onChange={(e) => setChestCm(e.target.value)}
              placeholder="np. 103"
              className="h-10 border-white/15 bg-black/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thighCm">Udo (cm)</Label>
            <Input
              id="thighCm"
              inputMode="decimal"
              value={thighCm}
              onChange={(e) => setThighCm(e.target.value)}
              placeholder="np. 58"
              className="h-10 border-white/15 bg-black/40"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ScoreSlider
            label="Energia w ciągu dnia"
            value={scores.dayEnergy}
            onChange={(v) => setScores((s) => ({ ...s, dayEnergy: v }))}
          />
          <ScoreSlider
            label="Energia na treningu"
            value={scores.trainingEnergy}
            onChange={(v) => setScores((s) => ({ ...s, trainingEnergy: v }))}
          />
          <ScoreSlider
            label="Trawienie"
            value={scores.digestionScore}
            onChange={(v) => setScores((s) => ({ ...s, digestionScore: v }))}
          />
          <ScoreSlider
            label="Sen"
            value={scores.sleepQuality}
            onChange={(v) => setScores((s) => ({ ...s, sleepQuality: v }))}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cardioCompliance">Czy cardio zrealizowane zgodnie z zaleceniami?</Label>
            <select
              id="cardioCompliance"
              value={cardioCompliance}
              onChange={(e) => setCardioCompliance(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
            >
              <option value="">— wybierz —</option>
              <option value="tak">TAK</option>
              <option value="nie">NIE</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dietCompliance">Czy dieta zgodnie z zaleceniami?</Label>
            <select
              id="dietCompliance"
              value={dietCompliance}
              onChange={(e) => setDietCompliance(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
            >
              <option value="">— wybierz —</option>
              <option value="tak">TAK</option>
              <option value="nie">NIE</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainingCompliance">Czy trening zgodnie z zaleceniami?</Label>
            <select
              id="trainingCompliance"
              value={trainingCompliance}
              onChange={(e) => setTrainingCompliance(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
            >
              <option value="">— wybierz —</option>
              <option value="tak">TAK</option>
              <option value="nie">NIE</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="complianceNotes">
            Jeśli przy cardio, diecie lub treningach masz chociaż jedno NIE — napisz, czego nie udało się
            zrealizować i w jakim zakresie
          </Label>
          <textarea
            id="complianceNotes"
            rows={3}
            value={complianceNotes}
            onChange={(e) => setComplianceNotes(e.target.value)}
            placeholder="Opcjonalnie…"
            className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalInfo">Informacje dodatkowe</Label>
          <textarea
            id="additionalInfo"
            rows={4}
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Samopoczucie, treningi, odstępstwa od diety…"
            className="w-full resize-y rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-4">
            <Label htmlFor="photos">Zdjęcia sylwetki</Label>
            <span className="text-xs text-white/50">{photosHint}</span>
          </div>
          <Input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            disabled={!canAddMorePhotos || pending}
            className="h-10 border-white/15 bg-black/40 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/15"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              const room = maxPhotos - photos.length;
              const picked = files.slice(0, Math.max(0, room));
              setError(null);
              start(async () => {
                try {
                  const next = await Promise.all(
                    picked.map((f) =>
                      fileToResizedDataUrl(f, { maxSide: 1280, quality: 0.85 }),
                    ),
                  );
                  setPhotos((prev) => [...prev, ...next].slice(0, maxPhotos));
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Nie udało się wczytać zdjęć",
                  );
                } finally {
                  e.target.value = "";
                }
              });
            }}
          />

          {photos.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((src, idx) => (
                <div
                  key={`${idx}-${src.slice(0, 32)}`}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
                >
                  <Image
                    src={src}
                    alt={`Zdjęcie sylwetki ${idx + 1}`}
                    width={400}
                    height={320}
                    unoptimized
                    className="h-32 w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => setPhotos((p) => p.filter((_, i) => i !== idx))}
                  >
                    Usuń
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/50">
              Dodaj 1–{maxPhotos} zdjęć (zostaną zapisane jako skompresowane JPG).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="h-11 bg-[var(--neon)] text-base font-semibold text-white hover:bg-[#ff4d6d]"
          >
            {pending ? "Zapisywanie…" : "Zapisz raport"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white/85">{label}</p>
        <p className="tabular-nums text-sm text-white/70">{value}/10</p>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--neon)]"
        aria-label={label}
      />
      <div className="mt-2 flex justify-between text-[11px] text-white/40">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  );
}


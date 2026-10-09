"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { AppPageHeader } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BUG_PRIORITIES,
  BUG_PRIORITY_LABELS,
  type BugPriority,
} from "@/lib/bug-reports";
import { fileToCompressedImageDataUrl } from "@/lib/client-image-data-url";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { cn } from "@/lib/utils";

const PRIORITY_RING: Record<BugPriority, string> = {
  highest: "border-red-500/70 bg-red-500/15 text-red-100",
  high: "border-orange-400/70 bg-orange-400/15 text-orange-100",
  medium: "border-amber-300/70 bg-amber-300/15 text-amber-50",
  low: "border-sky-400/70 bg-sky-400/15 text-sky-100",
  lowest: "border-white/25 bg-white/[0.06] text-white/80",
};

const MAX_PHOTOS = 4;

export function BugReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAdmin = searchParams.get("from") === "admin";
  const backHref = fromAdmin ? "/admin/bugs" : "/";
  const { notifySaved, notifyError } = useSaveFeedback();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [description, setDescription] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [priority, setPriority] = useState<BugPriority | "">("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      notifyError(`Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęcia.`);
      return;
    }

    setAddingPhoto(true);
    try {
      const next: string[] = [];
      const list = Array.from(files).slice(0, room);
      for (const file of list) {
        if (!file.type.startsWith("image/")) {
          notifyError("Wybierz plik graficzny (zdjęcie / zrzut ekranu).");
          continue;
        }
        try {
          next.push(await fileToCompressedImageDataUrl(file));
        } catch {
          notifyError("Nie udało się przygotować zdjęcia — spróbuj innego.");
        }
      }
      if (next.length > 0) {
        setPhotos((prev) => [...prev, ...next].slice(0, MAX_PHOTOS));
      }
    } finally {
      setAddingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!priority) {
      notifyError("Wybierz priorytet zgłoszenia.");
      return;
    }
    if (
      !description.trim() ||
      !expectedBehavior.trim() ||
      !stepsToReproduce.trim()
    ) {
      notifyError("Uzupełnij wszystkie pola tekstowe.");
      return;
    }

    setSubmitting(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({
          description: description.trim(),
          expectedBehavior: expectedBehavior.trim(),
          stepsToReproduce: stepsToReproduce.trim(),
          priority,
          photoDataUrls: photos,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        notifyError(data?.error ?? "Nie udało się wysłać zgłoszenia.");
        return;
      }
      notifySaved("Zgłoszenie wysłane. Dziękujemy!");
      router.push(fromAdmin ? "/admin/bugs" : "/");
      router.refresh();
    } catch {
      notifyError("Nie udało się wysłać zgłoszenia.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 px-0.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {fromAdmin ? "Wróć do panelu" : "Wróć"}
        </Link>
        <AppPageHeader
          kicker={fromAdmin ? "Admin" : "Testy"}
          title="Zgłoś błąd"
          description="Opisz problem tak, żeby dało się go odtworzyć i naprawić. Możesz dołączyć zrzuty ekranu."
        />
      </div>

      <form onSubmit={onSubmit} className="app-card space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="bug-description">Opis błędu</Label>
          <Textarea
            id="bug-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Co poszło nie tak? Co widzisz na ekranie?"
            className="min-h-28"
            maxLength={8000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bug-expected">Jak powinno wyglądać</Label>
          <Textarea
            id="bug-expected"
            required
            value={expectedBehavior}
            onChange={(e) => setExpectedBehavior(e.target.value)}
            placeholder="Jaki wynik lub wygląd oczekujesz?"
            className="min-h-24"
            maxLength={8000}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bug-steps">Jak odtworzyć błąd</Label>
          <Textarea
            id="bug-steps"
            required
            value={stepsToReproduce}
            onChange={(e) => setStepsToReproduce(e.target.value)}
            placeholder="1. Wejdź w…&#10;2. Kliknij…&#10;3. Zobaczysz…"
            className="min-h-28"
            maxLength={8000}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Zdjęcia / zrzuty ekranu</Label>
            <span className="text-[11px] text-white/40">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>
          {photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {photos.map((src, i) => (
                <li
                  key={`${i}-${src.slice(0, 24)}`}
                  className="relative overflow-hidden rounded-xl border border-white/12 bg-black/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Załącznik ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Usuń zdjęcie ${i + 1}`}
                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full border-white/15 bg-white/[0.06]"
            disabled={addingPhoto || photos.length >= MAX_PHOTOS || submitting}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {addingPhoto
              ? "Dodawanie…"
              : photos.length >= MAX_PHOTOS
                ? "Limit zdjęć osiągnięty"
                : "Dodaj zdjęcie"}
          </Button>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-white/85">
            Priorytet <span className="text-white/45">(wymagany)</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-1">
            {BUG_PRIORITIES.map((value) => {
              const selected = priority === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? PRIORITY_RING[value]
                      : "border-white/12 bg-black/30 text-white/70 hover:border-white/25 hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-current" : "border-white/35",
                    )}
                    aria-hidden
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-current" />
                    ) : null}
                  </span>
                  <span className="font-medium">
                    {BUG_PRIORITY_LABELS[value]}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button type="submit" className="w-full" disabled={submitting || addingPhoto}>
          {submitting ? "Wysyłanie…" : "Wyślij zgłoszenie"}
        </Button>
      </form>
    </div>
  );
}

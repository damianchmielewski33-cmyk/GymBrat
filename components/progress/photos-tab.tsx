"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type { ProgressHubData, ProgressPhotoItem } from "@/lib/progress-hub";
import { cn } from "@/lib/utils";

const BASELINE_KEY = "gymbrat:photo-baseline-id:v1";

function formatShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function fmtDelta(n: number | null, unit: string): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} ${unit}`;
}

export function PhotosTab({ data }: { data: ProgressHubData["photos"] }) {
  const { items, now } = data;
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pos, setPos] = useState(50);

  useEffect(() => {
    try {
      setBaselineId(window.localStorage.getItem(BASELINE_KEY));
    } catch {
      setBaselineId(null);
    }
  }, []);

  const start: ProgressPhotoItem | null = useMemo(() => {
    if (baselineId) {
      const found = items.find((p) => p.id === baselineId);
      if (found) return found;
    }
    return data.start;
  }, [baselineId, items, data.start]);

  function chooseBaseline(id: string) {
    setBaselineId(id);
    try {
      window.localStorage.setItem(BASELINE_KEY, id);
    } catch {
      /* ignore */
    }
    setPickerOpen(false);
  }

  const weightDelta =
    start?.weightKg != null && now?.weightKg != null
      ? Math.round((now.weightKg - start.weightKg) * 10) / 10
      : data.weightDeltaKg;
  const waistDelta =
    start?.waistCm != null && now?.waistCm != null
      ? Math.round((now.waistCm - start.waistCm) * 10) / 10
      : data.waistDeltaCm;

  const canCompare = Boolean(start && now && start.id !== now.id);

  return (
    <div className="space-y-5">
      <section className="app-card space-y-3 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Porównanie
        </p>

        {!canCompare ? (
          <div className="rounded-2xl bg-black/30 px-4 py-10 text-center">
            <p className="text-sm text-white/55">
              Dodaj co najmniej dwa zdjęcia w raportach, żeby porównać Start i Teraz.
            </p>
            <Link
              href="/reports?new=1"
              className="mt-3 inline-flex text-sm font-medium text-[var(--gym-gold)]"
            >
              Przejdź do raportów
            </Link>
          </div>
        ) : (
          <>
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
              <Image
                src={now!.dataUrl}
                alt="Zdjęcie teraz"
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 430px"
              />
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
              >
                <Image
                  src={start!.dataUrl}
                  alt="Zdjęcie startowe"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 430px"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/90"
                style={{ left: `${pos}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black"
                style={{ left: `${pos}%` }}
              >
                <MoveHorizontal className="h-4 w-4" />
              </div>
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                Start
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                Teraz · {formatShort(now!.date)}
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                className="absolute inset-0 z-10 cursor-ew-resize opacity-0"
                aria-label="Porównanie Start i Teraz"
              />
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="block w-full text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 hover:text-white/70"
            >
              Zmień zdjęcie startowe
            </button>
          </>
        )}

        {pickerOpen && items.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseBaseline(p.id)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl border",
                  start?.id === p.id
                    ? "border-[var(--gym-gold)]"
                    : "border-white/10",
                )}
              >
                <Image
                  src={p.dataUrl}
                  alt={`Zdjęcie z ${p.date}`}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="120px"
                />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionLabel index="02" title="Start i Teraz" />
        <div className="grid grid-cols-2 gap-2.5">
          <PhotoMetricCard
            label="Start"
            photo={start}
            fallbackDate={data.start?.date}
          />
          <PhotoMetricCard label="Teraz" photo={now} fallbackDate={data.now?.date} />
        </div>
        <div className="app-card grid grid-cols-2 gap-3 px-4 py-3.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Waga
            </p>
            <p
              className={cn(
                "mt-1 font-metric text-xl tabular-nums",
                weightDelta != null && weightDelta < 0
                  ? "text-emerald-400"
                  : "text-white",
              )}
            >
              {fmtDelta(weightDelta, "kg")}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Pas
            </p>
            <p
              className={cn(
                "mt-1 font-metric text-xl tabular-nums",
                waistDelta != null && waistDelta < 0
                  ? "text-emerald-400"
                  : "text-white",
              )}
            >
              {fmtDelta(waistDelta, "cm")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PhotoMetricCard({
  label,
  photo,
  fallbackDate,
}: {
  label: string;
  photo: ProgressPhotoItem | null;
  fallbackDate?: string;
}) {
  return (
    <div className="app-card overflow-hidden p-0">
      <div className="relative aspect-[3/4] bg-black/40">
        {photo ? (
          <Image
            src={photo.dataUrl}
            alt={label}
            fill
            unoptimized
            className="object-cover"
            sizes="200px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/35">
            Brak zdjęcia
          </div>
        )}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gym-gold)]">
          {label}
        </p>
        <p className="text-[11px] text-white/45">
          {photo?.date
            ? formatShort(photo.date)
            : fallbackDate
              ? formatShort(fallbackDate)
              : "—"}
        </p>
        <p className="text-sm text-white/80">
          {photo?.weightKg != null
            ? `${photo.weightKg.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} kg`
            : "— kg"}
          {" · "}
          {photo?.waistCm != null
            ? `${photo.waistCm.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm`
            : "— cm"}
        </p>
      </div>
    </div>
  );
}

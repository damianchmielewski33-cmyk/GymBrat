"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { ChangeStartPhotoButton } from "@/components/progress/change-start-photo-button";
import { SectionLabel } from "@/components/ui/section-label";

function formatShort(iso: string | null) {
  if (!iso) return "";
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

function fmtDeltaKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${String(r).replace(".", ",")} kg`;
}

export function HomePrzemianaSection({
  firstPhotoUrl,
  latestPhotoUrl,
  latestPhotoDate,
  weightFromStartKg,
}: {
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
  latestPhotoDate: string | null;
  weightFromStartKg: number | null;
}) {
  const [pos, setPos] = useState(50);
  const canCompare = Boolean(firstPhotoUrl && latestPhotoUrl);

  return (
    <section className="space-y-3">
      <SectionLabel
        index={4}
        title="Przemiana"
        trailing={fmtDeltaKg(weightFromStartKg) || undefined}
      />

      {!canCompare ? (
        <div className="app-card px-4 py-8 text-center">
          <p className="text-sm text-white/50">
            Dodaj zdjęcia w raporcie, żeby zobaczyć porównanie Start / Teraz.
          </p>
          <Link
            href="/reports?new=1"
            className="mt-3 inline-flex text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]"
          >
            Wyślij raport ze zdjęciem
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-black">
            <Image
              src={latestPhotoUrl!}
              alt="Teraz"
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
                src={firstPhotoUrl!}
                alt="Start"
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 430px"
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--gym-gold)]"
              style={{ left: `${pos}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--gym-gold)] text-black shadow-[0_0_20px_rgba(235,196,74,0.45)]"
              style={{ left: `${pos}%` }}
            >
              <MoveHorizontal className="h-4 w-4" />
            </div>
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              Start
            </div>
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-[var(--gym-gold)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">
              Teraz
              {latestPhotoDate ? ` · ${formatShort(latestPhotoDate)}` : ""}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              className="absolute inset-0 z-10 cursor-ew-resize opacity-0"
              aria-label="Porównanie przemiany"
            />
          </div>
          <ChangeStartPhotoButton />
        </div>
      )}
    </section>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { MoveHorizontal } from "lucide-react";

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

export function TransformationSlider({
  firstPhotoUrl,
  latestPhotoUrl,
  latestPhotoDate,
}: {
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
  latestPhotoDate?: string | null;
}) {
  const [pos, setPos] = useState(50);
  const canCompare = Boolean(firstPhotoUrl && latestPhotoUrl);

  return (
    <section className="app-card p-5">
      <p className="app-label">Twoja przemiana</p>

      {!canCompare ? (
        <div className="mt-4 rounded-2xl bg-black/30 px-4 py-10 text-center">
          <p className="text-sm text-white/55">
            Dodaj zdjęcia sylwetki w raporcie, żeby zobaczyć porównanie suwakiem.
          </p>
          <Link
            href="/reports"
            className="mt-3 inline-flex text-sm font-medium text-[var(--neon)]"
          >
            Przejdź do raportów
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
            <Image
              src={latestPhotoUrl!}
              alt="Ostatnie zdjęcie z raportu"
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
                alt="Pierwsze zdjęcie w aplikacji"
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
              Teraz{latestPhotoDate ? ` · ${formatShort(latestPhotoDate)}` : ""}
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
          <Link
            href="/reports"
            className="block text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40"
          >
            Zmień zdjęcie startowe
          </Link>
        </div>
      )}
    </section>
  );
}

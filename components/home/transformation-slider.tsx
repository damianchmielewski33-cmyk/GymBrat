"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import Link from "next/link";

export function TransformationSlider({
  firstPhotoUrl,
  latestPhotoUrl,
}: {
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
}) {
  const [pos, setPos] = useState(50);
  const canCompare = Boolean(firstPhotoUrl && latestPhotoUrl);

  return (
    <section className="glass-panel neon-glow relative flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(800px_360px_at_80%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
          Postęp
        </p>
        <h2 className="font-heading mt-1 text-base font-semibold text-white sm:text-lg">
          Twoja przemiana
        </h2>
        <p className="mt-1 text-xs text-white/50">
          Pierwsze zdjęcie porównane z ostatnim z raportu.
        </p>

        {!canCompare ? (
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/25 px-4 py-6 text-center">
            <p className="text-sm text-white/60">
              Dodaj zdjęcia sylwetki w raporcie, żeby zobaczyć porównanie
              suwakiem.
            </p>
            <Link
              href="/reports"
              className="mt-3 inline-flex text-sm font-medium text-[var(--neon)] underline-offset-4 hover:underline"
            >
              Przejdź do raportów
            </Link>
          </div>
        ) : (
          <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-3">
            <div className="relative aspect-[4/5] min-h-[14rem] w-full flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:aspect-auto sm:min-h-[16rem]">
              <Image
                src={latestPhotoUrl!}
                alt="Ostatnie zdjęcie z raportu"
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 420px"
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
                  sizes="(max-width: 768px) 100vw, 420px"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.55)]"
                style={{ left: `${pos}%` }}
              />
              <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/85">
                Start
              </div>
              <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/85">
                Teraz
              </div>
            </div>
            <label className="block">
              <span className="sr-only">Porównanie przemiany</span>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                className="score-range block w-full"
                style={{ "--range-pct": `${pos}%` } as CSSProperties}
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

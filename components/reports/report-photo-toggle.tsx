"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { bodyReportPhotoMediaPath } from "@/lib/user-photo-media";

export type ReportPhoto = { id: string };

export function ReportPhotoToggle({
  reportId,
  photos,
  compact = false,
}: {
  reportId: string;
  photos: ReportPhoto[];
  /** W tabeli historii — krótszy przycisk, galeria pod wierszem. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!photos.length) return null;

  const galleryId = `report-photos-${reportId}`;

  return (
    <div
      className={
        compact
          ? "flex min-w-[4.5rem] flex-col gap-2"
          : "flex w-full flex-col gap-3 lg:max-w-[420px] lg:shrink-0"
      }
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={
          compact
            ? "h-8 shrink-0 border-[#d4af37]/35 bg-[#d4af37]/10 px-2.5 text-[11px] font-semibold text-[#e8c547] hover:bg-[#d4af37]/20 hover:text-[#f7e28f]"
            : "w-fit border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white"
        }
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={galleryId}
      >
        {compact
          ? open
            ? "Ukryj"
            : "Zobacz"
          : open
            ? "Ukryj zdjęcia"
            : `Zobacz zdjęcia (${photos.length})`}
      </Button>
      {open ? (
        <div
          id={galleryId}
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4"
        >
          {photos.slice(0, 8).map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-black/30"
            >
              <Image
                src={bodyReportPhotoMediaPath(p.id)}
                alt="Zdjęcie sylwetki"
                width={320}
                height={240}
                unoptimized
                className="h-24 w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

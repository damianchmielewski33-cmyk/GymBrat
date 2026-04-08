"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export type ReportPhoto = { id: string; dataUrl: string };

export function ReportPhotoToggle({
  reportId,
  photos,
}: {
  reportId: string;
  photos: ReportPhoto[];
}) {
  const [open, setOpen] = useState(false);
  if (!photos.length) return null;

  const galleryId = `report-photos-${reportId}`;

  return (
    <div className="flex w-full flex-col gap-3 lg:max-w-[420px] lg:shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit border-white/15 bg-white/5 text-white/90 hover:bg-white/10 hover:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={galleryId}
      >
        {open ? "Ukryj zdjęcia" : `Zobacz zdjęcia (${photos.length})`}
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
                src={p.dataUrl}
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

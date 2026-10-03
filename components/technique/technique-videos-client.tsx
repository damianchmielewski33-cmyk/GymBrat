"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Film, Trash2, Video } from "lucide-react";
import { AppPageHeader } from "@/components/layout/screen";
import { SectionLabel } from "@/components/ui/section-label";

const STORAGE_KEY = "gymbrat.technique_videos.v1";

type TechniqueVideoLocal = {
  id: string;
  name: string;
  /** Object URL or data URL — data URL for persistence across reloads. */
  dataUrl: string;
  createdAt: number;
  sizeBytes: number;
};

function loadVideos(): TechniqueVideoLocal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is TechniqueVideoLocal =>
        !!v &&
        typeof v === "object" &&
        typeof (v as TechniqueVideoLocal).id === "string" &&
        typeof (v as TechniqueVideoLocal).dataUrl === "string",
    );
  } catch {
    return [];
  }
}

function saveVideos(items: TechniqueVideoLocal[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(ms: number): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return "";
  }
}

const MAX_BYTES = 12 * 1024 * 1024;

export function TechniqueVideosClient() {
  const inputId = useId();
  const [videos, setVideos] = useState<TechniqueVideoLocal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVideos(loadVideos());
  }, []);

  async function onPick(file: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Wybierz plik wideo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Film jest za duży (max ok. 12 MB w lokalnym MVP).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl.startsWith("data:")) {
        setError("Nie udało się odczytać pliku.");
        return;
      }
      const next: TechniqueVideoLocal = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.[^.]+$/, "") || "Technika",
        dataUrl,
        createdAt: Date.now(),
        sizeBytes: file.size,
      };
      const list = [next, ...loadVideos()].slice(0, 20);
      saveVideos(list);
      setVideos(list);
    } catch {
      setError("Zapis się nie udał — spróbuj mniejszego pliku.");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    const list = loadVideos().filter((v) => v.id !== id);
    saveVideos(list);
    setVideos(list);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 pb-10">
      <AppPageHeader
        kicker="Trening"
        title="Korekta techniki"
        description="MVP lokalne — filmy zostają na tym urządzeniu (localStorage)."
      />

      <section className="space-y-3">
        <SectionLabel index={1} title="Nagraj technikę" />
        <div className="app-card space-y-4 p-4">
          <p className="text-sm text-white/55">
            Wybierz nagranie z telefonu. Możesz później wysłać je Damianowi przez{" "}
            <Link href="/inbox" className="text-[var(--gym-gold)] underline-offset-2 hover:underline">
              Skrzynkę
            </Link>
            .
          </p>
          <label
            htmlFor={inputId}
            className="gold-btn inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm"
          >
            <Video className="h-4 w-4" aria-hidden />
            {busy ? "Zapisuję…" : "Wybierz film"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="video/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onPick(f);
              e.target.value = "";
            }}
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </section>

      <section id="moje-filmy" className="space-y-3 scroll-mt-24">
        <SectionLabel
          index={2}
          title="Moje filmy"
          trailing={videos.length > 0 ? String(videos.length) : "—"}
        />
        {videos.length === 0 ? (
          <div className="app-card flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Film className="h-7 w-7 text-[var(--gym-gold)]/70" aria-hidden />
            <p className="text-sm text-white/50">Brak zapisanych filmów.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {videos.map((v) => (
              <li key={v.id} className="app-card overflow-hidden">
                <video
                  src={v.dataUrl}
                  controls
                  playsInline
                  className="aspect-video w-full bg-black object-contain"
                />
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {v.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-white/45">
                      {formatWhen(v.createdAt)} · {formatBytes(v.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:text-red-400"
                    aria-label="Usuń film"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

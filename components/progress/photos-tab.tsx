"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoveHorizontal } from "lucide-react";
import { clearStartPhotoAction } from "@/actions/start-photo";
import { revealProgressPhotosAction } from "@/actions/progress-photos";
import { ChangeStartPhotoButton } from "@/components/progress/change-start-photo-button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  Explainer,
  ProgressSection,
  Surface,
} from "@/components/progress/progress-ui";
import { fmtNum, fmtSigned, formatDayMonth } from "@/lib/progress-format";
import type { ProgressHubData, ProgressPhotoItem } from "@/lib/progress-hub";
import { CUSTOM_START_PHOTO_ID } from "@/lib/start-photo-id";
import { cn } from "@/lib/utils";

const BASELINE_KEY = "gymbrat:photo-baseline-id:v1";

function daysBetween(a: string, b: string): number | null {
  try {
    const t0 = new Date(`${a}T12:00:00`).getTime();
    const t1 = new Date(`${b}T12:00:00`).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
    return Math.max(0, Math.round(Math.abs(t1 - t0) / (24 * 60 * 60 * 1000)));
  } catch {
    return null;
  }
}

function DeltaChip({
  label,
  from,
  to,
  unit,
  delta,
  good,
}: {
  label: string;
  from: number | null | undefined;
  to: number | null | undefined;
  unit: string;
  delta: number | null;
  /** true gdy zmiana jest „na plus” dla użytkownika. */
  good: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-metric text-[1.1rem] leading-none tabular-nums",
          good ? "text-emerald-300" : "text-white",
        )}
      >
        {fmtSigned(delta, ` ${unit}`, 1)}
      </p>
      <p className="mt-1 text-[11px] tabular-nums text-white/40">
        {fmtNum(from ?? null)} → {fmtNum(to ?? null)} {unit}
      </p>
    </div>
  );
}

/**
 * Porównanie zdjęć Start ↔ Teraz. Jedna karta z suwakiem zamiast trzech
 * powtórzeń tych samych zdjęć i wag (suwak, dwie karty Start/Teraz, tabela).
 */
export function PhotoCompareSection() {
  const [data, setData] = useState<ProgressHubData["photos"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await revealProgressPhotosAction();
      if (result.ok) setData(result.data);
      else setError(result.error);
    } catch {
      setError("Nie udało się wczytać zdjęć.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <p className="px-3.5 py-5 text-center text-[13px] text-[var(--gym-text-secondary)]">Ładowanie zdjęć…</p>;
  if (error || !data) return (
    <div className="space-y-2 p-3.5 text-center">
      <p role="alert" className="text-[13px] text-[var(--gym-text-secondary)]">{error ?? "Nie udało się wczytać zdjęć."}</p>
      <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-[var(--gym-border-gold)] px-4 text-[13px] font-semibold text-white">Spróbuj ponownie</button>
    </div>
  );
  return <PhotoCompareContent data={data} />;
}

function PhotoCompareContent({ data }: { data: ProgressHubData["photos"] }) {
  const { items, now } = data;
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [, startClear] = useTransition();
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pos, setPos] = useState(50);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try { setBaselineId(window.localStorage.getItem(BASELINE_KEY)); }
      catch { setBaselineId(null); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const start: ProgressPhotoItem | null = useMemo(() => {
    // Własne zdjęcie z galerii ma pierwszeństwo przed wyborem z raportów.
    if (data.hasCustomStart && data.start?.id === CUSTOM_START_PHOTO_ID) {
      return data.start;
    }
    if (baselineId) {
      const found = items.find((p) => p.id === baselineId);
      if (found) return found;
    }
    return data.start;
  }, [baselineId, items, data.start, data.hasCustomStart]);

  function chooseBaseline(id: string) {
    setBaselineId(id);
    try {
      window.localStorage.setItem(BASELINE_KEY, id);
    } catch {
      /* ignore */
    }
    setPickerOpen(false);
    if (data.hasCustomStart) {
      startClear(async () => {
        const r = await clearStartPhotoAction();
        if (!r.ok) {
          notifyError(r.error ?? "Nie udało się przełączyć zdjęcia.");
          return;
        }
        notifySaved("Ustawiono start z raportu.");
        router.refresh();
      });
    }
  }

  const weightDelta =
    start?.weightKg != null && now?.weightKg != null
      ? Math.round((now.weightKg - start.weightKg) * 10) / 10
      : data.weightDeltaKg;
  const waistDelta =
    start?.waistCm != null && now?.waistCm != null
      ? Math.round((now.waistCm - start.waistCm) * 10) / 10
      : data.waistDeltaCm;

  const spanDays = start && now ? daysBetween(start.date, now.date) : null;
  const canCompare = Boolean(start && now && start.id !== now.id);

  return (
    <ProgressSection
      title="Zdjęcia · Start i Teraz"
      trailing={spanDays != null ? `${spanDays} dni` : undefined}
    >
      {!canCompare ? (
        <Surface className="py-5 text-center">
          <p className="text-[13px] leading-snug text-white/55">
            Dodaj co najmniej dwa zdjęcia w raportach, żeby porównać Start i
            Teraz.
          </p>
          <Link
            href="/reports?new=1"
            className="mt-3 inline-flex text-sm font-medium text-[var(--gym-gold)]"
          >
            Przejdź do raportów
          </Link>
        </Surface>
      ) : (
        <div className="space-y-2.5">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black">
            <Image
              src={now!.src}
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
                src={start!.src}
                alt="Zdjęcie startowe"
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 430px"
              />
            </div>

            <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
              Start · {formatDayMonth(start!.date)}
            </span>
            <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-[var(--gym-gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
              Teraz · {formatDayMonth(now!.date)}
            </span>

            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--gym-gold)]"
              style={{ left: `${pos}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/20 bg-[var(--gym-gold)] text-black shadow-[0_0_18px_rgba(235,196,74,0.45)]"
              style={{ left: `${pos}%` }}
            >
              <MoveHorizontal className="h-4 w-4" />
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

          {weightDelta != null || waistDelta != null ? (
            <div className="flex gap-2">
              {weightDelta != null ? (
                <DeltaChip
                  label="Waga"
                  from={start?.weightKg}
                  to={now?.weightKg}
                  unit="kg"
                  delta={weightDelta}
                  good={weightDelta < 0}
                />
              ) : null}
              {waistDelta != null ? (
                <DeltaChip
                  label="Pas"
                  from={start?.waistCm}
                  to={now?.waistCm}
                  unit="cm"
                  delta={waistDelta}
                  good={waistDelta < 0}
                />
              ) : null}
            </div>
          ) : null}

          <ChangeStartPhotoButton hasCustomStart={data.hasCustomStart} />

          {items.length > 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="block w-full text-center text-[10px] font-medium uppercase tracking-[0.14em] text-white/40"
            >
              {pickerOpen ? "Ukryj zdjęcia z raportów" : "Albo wybierz z raportów"}
            </button>
          ) : null}

          {pickerOpen && items.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => chooseBaseline(p.id)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border",
                    !data.hasCustomStart && start?.id === p.id
                      ? "border-[var(--gym-gold)]"
                      : "border-white/10",
                  )}
                >
                  <Image
                    src={p.src}
                    alt={`Zdjęcie z ${p.date}`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="120px"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-0.5 text-center text-[9px] text-white/80">
                    {formatDayMonth(p.date)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <Explainer label="Skąd te zdjęcia">
            <p>
              Start to{" "}
              {start!.id === CUSTOM_START_PHOTO_ID
                ? "zdjęcie z galerii"
                : data.start?.id === start!.id
                  ? "pierwszy raport"
                  : "wybrany raport"}{" "}
              ({formatDayMonth(start!.date)}), Teraz to raport z{" "}
              {formatDayMonth(now!.date)}. Wagi i obwody pochodzą z tych samych
              raportów.
            </p>
          </Explainer>
        </div>
      )}
    </ProgressSection>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoveHorizontal } from "lucide-react";
import { clearStartPhotoAction } from "@/actions/start-photo";
import { ChangeStartPhotoButton } from "@/components/progress/change-start-photo-button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SectionLabel } from "@/components/ui/section-label";
import type { ProgressHubData, ProgressPhotoItem } from "@/lib/progress-hub";
import { CUSTOM_START_PHOTO_ID } from "@/lib/start-photo-id";
import { cn } from "@/lib/utils";

const BASELINE_KEY = "gymbrat:photo-baseline-id:v1";

function formatDayMonth(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

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

function fmtNum(n: number | null, digits = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("pl-PL", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtDelta(n: number | null, unit: string): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n).toLocaleString("pl-PL", {
    maximumFractionDigits: 1,
  });
  return `${sign}${abs} ${unit}`;
}

export function PhotosTab({ data }: { data: ProgressHubData["photos"] }) {
  const { items, now } = data;
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [, startClear] = useTransition();
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

  const spanDays =
    start && now ? daysBetween(start.date, now.date) : null;
  const canCompare = Boolean(start && now && start.id !== now.id);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        {!canCompare ? (
          <div className="app-panel px-4 py-10 text-center">
            <p className="text-sm text-white/55">
              Dodaj co najmniej dwa zdjęcia w raportach, żeby porównać Start i
              Teraz.
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
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black">
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
          </>
        )}

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
                  src={p.dataUrl}
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
      </section>

      <section className="space-y-2.5">
        <SectionLabel
          index={2}
          title="Start i Teraz"
          trailing={spanDays != null ? `${spanDays} dni` : undefined}
          titleTone="white"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <PhotoMetricCard kind="start" photo={start} />
          <PhotoMetricCard kind="now" photo={now} />
        </div>

        <div className="overflow-hidden app-panel divide-y divide-white/[0.06]">
          <MetricRow
            label="Waga"
            from={start?.weightKg}
            to={now?.weightKg}
            unit="kg"
            delta={weightDelta}
            deltaTone={
              weightDelta != null && weightDelta < 0
                ? "text-white"
                : "text-white"
            }
          />
          <MetricRow
            label="Pas"
            from={start?.waistCm}
            to={now?.waistCm}
            unit="cm"
            delta={waistDelta}
            deltaTone={
              waistDelta != null && waistDelta < 0
                ? "text-emerald-400"
                : "text-white"
            }
          />
        </div>

        {start && now ? (
          <p className="px-0.5 text-[11px] leading-relaxed text-white/40">
            Start to{" "}
            {start.id === CUSTOM_START_PHOTO_ID
              ? "zdjęcie z galerii"
              : data.start?.id === start.id
                ? "pierwszy raport"
                : "wybrany raport"}{" "}
            ({formatDayMonth(start.date)}), teraz to raport z{" "}
            {formatDayMonth(now.date)}.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function MetricRow({
  label,
  from,
  to,
  unit,
  delta,
  deltaTone,
}: {
  label: string;
  from: number | null | undefined;
  to: number | null | undefined;
  unit: string;
  delta: number | null;
  deltaTone: string;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 px-3.5 py-3.5">
      <p className="text-[13px] text-white/75">{label}</p>
      <p className="text-center text-[13px] tabular-nums text-white/55">
        {fmtNum(from ?? null, unit === "kg" ? 0 : 0)} →{" "}
        {fmtNum(to ?? null, unit === "kg" ? 0 : 0)} {unit}
      </p>
      <p className={cn("font-metric text-[16px] tabular-nums", deltaTone)}>
        {fmtDelta(delta, unit)}
      </p>
    </div>
  );
}

function PhotoMetricCard({
  kind,
  photo,
}: {
  kind: "start" | "now";
  photo: ProgressPhotoItem | null;
}) {
  const isNow = kind === "now";
  return (
    <div className="overflow-hidden app-panel">
      <div className="relative aspect-[3/4] bg-black/40">
        {photo ? (
          <Image
            src={photo.dataUrl}
            alt={isNow ? "Teraz" : "Start"}
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
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
            isNow
              ? "bg-[var(--gym-gold)] text-black"
              : "bg-black/55 text-white/90",
          )}
        >
          {isNow
            ? `Teraz · ${photo ? formatDayMonth(photo.date) : "—"}`
            : "Start"}
        </span>
      </div>
      <div className="space-y-0.5 px-3 py-2.5">
        <p className="font-metric text-[22px] tabular-nums leading-none text-white">
          {photo?.weightKg != null ? `${fmtNum(photo.weightKg, 0)} kg` : "—"}
        </p>
        <p className="text-[11px] text-white/45">
          {photo?.waistCm != null
            ? `pas ${fmtNum(photo.waistCm, 0)} cm`
            : "pas —"}
          {photo ? ` · ${formatDayMonth(photo.date)}` : ""}
        </p>
      </div>
    </div>
  );
}

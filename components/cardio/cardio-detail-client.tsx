"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Camera,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  deleteCardioLogAction,
  setCardioDevicePhotoAction,
  updateCardioLogAction,
} from "@/actions/cardio";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import {
  formatCardioDateLabel,
  formatDurationMmSs,
  formatPace,
  type CardioLogPayload,
} from "@/lib/cardio";
import { cn } from "@/lib/utils";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

type Props = {
  id: string;
  date: string;
  minutes: number;
  payload: CardioLogPayload;
  paceMinPerKm: number | null;
};

export function CardioDetailClient({
  id,
  date,
  minutes,
  payload,
  paceMinPerKm,
}: Props) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [photo, setPhoto] = useState(payload.devicePhotoDataUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const title = payload.title || "Cardio";
  const dateLabel = formatCardioDateLabel(date);
  const durationLabel = formatDurationMmSs(minutes);

  async function share() {
    const text = `${title} · ${minutes} min${
      payload.avgHr ? ` · ${payload.avgHr} bpm` : ""
    }${payload.distanceKm ? ` · ${payload.distanceKm} km` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `GymBrat — ${title}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      notifySaved("Skopiowano wynik do schowka.");
    } catch {
      /* user cancelled */
    }
  }

  function onPickPhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      start(async () => {
        const res = await setCardioDevicePhotoAction(id, dataUrl);
        if (res.ok) {
          setPhoto(dataUrl);
          notifySaved("Dodano zdjęcie ekranu.");
        } else {
          notifyError(res.error);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function remove() {
    if (!confirm("Usunąć ten wpis cardio?")) return;
    start(async () => {
      const res = await deleteCardioLogAction(id);
      if (res.ok) {
        notifySaved("Usunięto wpis.");
        router.push("/workout-plan");
        router.refresh();
      } else {
        notifyError(res.error);
      }
    });
  }

  const stats: { label: string; value: React.ReactNode }[] = [
    {
      label: "Czas",
      value: (
        <span className="font-metric text-xl text-white">{durationLabel}</span>
      ),
    },
    {
      label: "Tempo",
      value: (
        <span className="font-metric text-xl text-white">
          {formatPace(paceMinPerKm)}
        </span>
      ),
    },
    {
      label: "Tętno",
      value:
        payload.avgHr != null ? (
          <span className="font-metric text-xl text-white">
            <AnimatedMetric value={payload.avgHr} />{" "}
            <span className="font-sans text-sm text-white/55">bpm</span>
          </span>
        ) : (
          <span className="font-metric text-xl text-white">—</span>
        ),
    },
    {
      label: "Dystans",
      value: (
        <span className="font-metric text-xl text-white">
          {payload.distanceKm != null
            ? `${payload.distanceKm.toLocaleString("pl-PL", {
                maximumFractionDigits: 2,
              })} km`
            : "—"}
        </span>
      ),
    },
    {
      label: "Kalorie",
      value: (
        <span className="font-metric text-xl text-white">
          {payload.calories != null ? (
            <AnimatedMetric value={payload.calories} />
          ) : (
            "—"
          )}
        </span>
      ),
    },
    {
      label: "Kroki",
      value: (
        <span className="font-metric text-xl text-white">
          {payload.steps != null ? (
            <AnimatedMetric value={payload.steps} />
          ) : (
            "—"
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/workout-plan"
        className="inline-flex items-center gap-1.5 text-sm text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </Link>

      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {dateLabel}
      </p>

      <div className="flex items-end justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <AnimatedMetric
              value={minutes}
              className="text-5xl leading-none text-white"
            />
            <span className="font-metric text-xl text-white/80">min</span>
          </div>
          <p className="mt-1 text-[11px] text-white/40">czas</p>
        </div>
      </div>

      <div className="app-card overflow-hidden px-3 py-4">
        <div className="grid grid-cols-3 gap-y-5">
          {stats.map((s) => (
            <div key={s.label} className="px-2 text-center">
              <p className="text-[11px] text-white/45">{s.label}</p>
              <div className="mt-1.5 border-t border-white/[0.06] pt-2">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void share()}
        className="gold-btn relative inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-[0_0_40px_rgba(235,196,74,0.35)]"
      >
        <Share2 className="h-5 w-5" />
        Udostępnij
      </button>

      <section className="space-y-3">
        <SectionLabel index={1} title="Ekran urządzenia" trailing="opcjonalnie" />
        <div className="flex items-start justify-between gap-3">
          <p className="max-w-[14rem] text-sm leading-snug text-white/55">
            Zdjęcie ekranu bieżni albo zegarka z wynikiem końcowym.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-black/30 px-3 text-sm text-white"
          >
            <Camera className="h-4 w-4" />
            Dodaj
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Ekran urządzenia"
            className="mt-2 max-h-56 w-full rounded-2xl object-cover"
          />
        ) : null}
      </section>

      <div className="flex items-center justify-between pt-4 text-sm text-white/70">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2"
        >
          <Pencil className="h-4 w-4" />
          Wpis ręczny
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex items-center gap-2 text-white/70"
        >
          <Trash2 className="h-4 w-4" />
          Usuń
        </button>
      </div>

      {editOpen ? (
        <ManualEditSheet
          id={id}
          title={title}
          minutes={minutes}
          distanceKm={payload.distanceKm}
          avgHr={payload.avgHr}
          calories={payload.calories}
          steps={payload.steps}
          notes={payload.notes}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ManualEditSheet({
  id,
  title,
  minutes,
  distanceKm,
  avgHr,
  calories,
  steps,
  notes,
  onClose,
  onSaved,
}: {
  id: string;
  title: string;
  minutes: number;
  distanceKm?: number | null;
  avgHr?: number | null;
  calories?: number | null;
  steps?: number | null;
  notes?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Zamknij" onClick={onClose} />
      <form
        className="relative z-[1] w-full max-w-lg space-y-3 rounded-t-[28px] border border-white/10 bg-[#0c0c0c] p-5 sm:rounded-[28px]"
        action={(fd) => {
          start(async () => {
            const res = await updateCardioLogAction({}, fd);
            if (res.ok) {
              notifySaved("Zapisano wpis.");
              onSaved();
            } else {
              notifyError(res.error ?? "Błąd zapisu");
            }
          });
        }}
      >
        <h2 className="text-xl font-semibold text-white">Wpis ręczny</h2>
        <input type="hidden" name="id" value={id} />
        <label className="block text-xs text-white/45">
          Aktywność
          <input
            name="title"
            defaultValue={title}
            className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs text-white/45">
            Minuty
            <input
              name="minutes"
              defaultValue={minutes}
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/45">
            Km
            <input
              name="distanceKm"
              defaultValue={distanceKm ?? ""}
              inputMode="decimal"
              className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/45">
            bpm
            <input
              name="avgHr"
              defaultValue={avgHr ?? ""}
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/45">
            kcal
            <input
              name="calories"
              defaultValue={calories ?? ""}
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/45">
            Kroki
            <input
              name="steps"
              defaultValue={steps ?? ""}
              inputMode="numeric"
              className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white"
            />
          </label>
        </div>
        <label className="block text-xs text-white/45">
          Notatka
          <textarea
            name="notes"
            defaultValue={notes ?? ""}
            rows={2}
            className="mt-1 w-full rounded-xl border border-white/12 bg-[#121212] px-3 py-2 text-sm text-white"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "gold-btn inline-flex h-12 w-full items-center justify-center rounded-2xl font-semibold",
            pending && "opacity-60",
          )}
        >
          {pending ? "Zapisuję…" : "Zapisz"}
        </button>
      </form>
    </div>
  );
}

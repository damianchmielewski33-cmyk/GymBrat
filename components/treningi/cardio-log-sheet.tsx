"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Footprints, Minus, Plus, X } from "lucide-react";
import { logCardioDetailedAction } from "@/actions/workout";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { cn } from "@/lib/utils";

const MACHINES = [
  "Marsz",
  "Bieżnia",
  "Rower",
  "Orbitrek",
  "Schody",
  "Bieg",
  "Pływanie",
  "Inne",
] as const;

type CardioLogSheetProps = {
  open: boolean;
  onClose: () => void;
  cardioGoalMinutes: number;
  /** Domyślny typ aktywności przy otwarciu. */
  defaultTitle?: (typeof MACHINES)[number] | string;
};

function todayLabelPl(): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
  } catch {
    return "dziś";
  }
}

function clampMinutes(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(300, Math.max(1, Math.round(n)));
}

const fieldClass =
  "mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-[var(--gym-surface-raised)] px-3 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[var(--gym-gold)]/45 focus:ring-2 focus:ring-[var(--gym-gold)]/20";

export function CardioLogSheet({
  open,
  onClose,
  cardioGoalMinutes,
  defaultTitle = "Marsz",
}: CardioLogSheetProps) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [mounted, setMounted] = useState(false);
  const [machine, setMachine] = useState<(typeof MACHINES)[number]>("Marsz");
  const [minutesText, setMinutesText] = useState("30");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [calories, setCalories] = useState("");
  const [steps, setSteps] = useState("");
  const [note, setNote] = useState("");

  const [state, formAction, pending] = useActionState(logCardioDetailedAction, {} as {
    ok?: boolean;
    error?: string;
    id?: string;
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const match = MACHINES.find(
      (m) => m.toLowerCase() === String(defaultTitle).toLowerCase(),
    );
    setMachine(match ?? "Marsz");
    setMinutesText("30");
    setDistanceKm("");
    setAvgHr("");
    setCalories("");
    setSteps("");
    setNote(match ? "" : String(defaultTitle));
  }, [open, defaultTitle]);

  useEffect(() => {
    if (state?.ok === true) {
      notifySaved("Zapisano cardio.");
      onClose();
      if (state.id) {
        router.push(`/cardio/${state.id}`);
        router.refresh();
      }
    } else if (state?.ok === false && state.error) {
      notifyError(state.error);
    }
  }, [state, notifySaved, notifyError, onClose, router]);

  const dateLine = useMemo(() => `zapisuję na dziś, ${todayLabelPl()}`, []);
  const minutes = clampMinutes(Number(String(minutesText).replace(",", ".")));

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-[3px]"
        aria-label="Zamknij"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardio-sheet-title"
        className="app-dialog relative z-[1] flex h-[min(88dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] sm:h-auto sm:max-h-[88dvh] sm:rounded-[22px]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(165deg, rgba(235,196,74,0.16) 0%, transparent 58%)",
          }}
          aria-hidden
        />

        <div className="relative flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Cardio
            </p>
            <h2
              id="cardio-sheet-title"
              className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-white"
            >
              Dodaj cardio
            </h2>
            <p className="mt-1.5 text-[13px] text-white/45">{dateLine}</p>
            <p className="mt-0.5 text-[12px] text-white/35">
              Zalecenie: {cardioGoalMinutes} min / tydzień
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08]"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={formAction} className="relative flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="title" value={machine} />
          <input type="hidden" name="minutes" value={minutes} />
          <input type="hidden" name="distanceKm" value={distanceKm} />
          <input type="hidden" name="avgHr" value={avgHr} />
          <input type="hidden" name="calories" value={calories} />
          <input type="hidden" name="steps" value={steps} />
          <input type="hidden" name="notes" value={note} />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
            <div className="flex flex-wrap gap-2">
              {MACHINES.map((m) => {
                const active = m === machine;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMachine(m)}
                    className={cn(
                      "inline-flex h-8 items-center rounded-full px-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
                      active
                        ? "border border-[var(--gym-gold)]/55 bg-[rgba(var(--neon-rgb),0.14)] text-[var(--gym-gold)] shadow-[0_4px_14px_rgba(235,196,74,0.18)]"
                        : "border border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/80",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="app-panel mt-5 px-4 py-4">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                <span>Czas · min</span>
                <span>wpisz albo ±5</span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Mniej minut"
                  onClick={() => setMinutesText(String(clampMinutes(minutes - 5)))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minutesText}
                  onChange={(e) => setMinutesText(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => setMinutesText(String(minutes))}
                  aria-label="Minuty cardio"
                  className="h-14 w-24 rounded-xl border border-[var(--gym-gold)]/40 bg-black/35 text-center font-metric text-4xl tabular-nums text-[var(--gym-gold)] outline-none focus:border-[var(--gym-gold)] focus:ring-2 focus:ring-[var(--gym-gold)]/25"
                />
                <button
                  type="button"
                  aria-label="Więcej minut"
                  onClick={() => setMinutesText(String(clampMinutes(minutes + 5)))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="app-label">Dystans (km)</span>
                <input
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  inputMode="decimal"
                  placeholder="np. 3,5"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="app-label">Śr. tętno</span>
                <input
                  value={avgHr}
                  onChange={(e) => setAvgHr(e.target.value)}
                  inputMode="numeric"
                  placeholder="np. 125"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="app-label">Kalorie</span>
                <input
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  inputMode="numeric"
                  placeholder="np. 280"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="app-label">Kroki</span>
                <input
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  inputMode="numeric"
                  placeholder="np. 4500"
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="mt-4 mb-2 block">
              <span className="app-label">Notatka</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="np. pod górkę, 6% nachylenia"
                className="mt-1.5 w-full resize-none rounded-xl border border-white/12 bg-[var(--gym-surface-raised)] px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[var(--gym-gold)]/45 focus:ring-2 focus:ring-[var(--gym-gold)]/20"
              />
            </label>
          </div>

          <div className="relative shrink-0 border-t border-white/[0.06] bg-[var(--gym-surface-sunken)]/95 px-5 pt-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] backdrop-blur-sm">
            <button
              type="submit"
              disabled={pending}
              className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-[0_8px_28px_rgba(235,196,74,0.45)] disabled:opacity-60"
            >
              <Footprints className="h-4 w-4" aria-hidden />
              {pending ? "Zapisuję…" : `Zapisz ${minutes} min`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

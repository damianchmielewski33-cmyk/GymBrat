"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Flame, Minus, Plus, X } from "lucide-react";
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

export function CardioLogSheet({ open, onClose, cardioGoalMinutes }: CardioLogSheetProps) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [machine, setMachine] = useState<(typeof MACHINES)[number]>("Marsz");
  const [minutesText, setMinutesText] = useState("30");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [note, setNote] = useState("");

  const [state, formAction, pending] = useActionState(logCardioDetailedAction, {} as {
    ok?: boolean;
    error?: string;
  });

  useEffect(() => {
    if (!open) return;
    setMachine("Marsz");
    setMinutesText("30");
    setDistanceKm("");
    setAvgHr("");
    setNote("");
  }, [open]);

  useEffect(() => {
    if (state?.ok === true) {
      notifySaved("Zapisano cardio.");
      onClose();
    } else if (state?.ok === false && state.error) {
      notifyError(state.error);
    }
  }, [state, notifySaved, notifyError, onClose]);

  const dateLine = useMemo(() => `zapisuję na dziś, ${todayLabelPl()}`, []);
  const minutes = clampMinutes(Number(String(minutesText).replace(",", ".")));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Zamknij"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardio-sheet-title"
        className="relative z-[1] flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom)))] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0c0c0c] sm:rounded-[28px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
              Cardio
            </p>
            <h2 id="cardio-sheet-title" className="mt-1 text-2xl font-semibold text-white">
              Dodaj wpis
            </h2>
            <p className="mt-1 text-sm text-white/55">{dateLine}</p>
            <p className="mt-0.5 text-xs text-white/40">
              Zalecenie: {cardioGoalMinutes} min / tydzień
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            // upewnij się, że minutes w hiddoch są zaktualizowane przed submitem
            const fd = new FormData(e.currentTarget);
            if (!fd.get("minutes")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="title" value={machine} />
          <input type="hidden" name="minutes" value={minutes} />
          <input type="hidden" name="distanceKm" value={distanceKm} />
          <input type="hidden" name="avgHr" value={avgHr} />
          <input type="hidden" name="notes" value={note} />

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <div className="mt-3 grid grid-cols-4 gap-2">
              {MACHINES.map((m) => {
                const active = m === machine;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMachine(m)}
                    className={cn(
                      "rounded-full px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition",
                      active
                        ? "border border-[var(--gym-gold)] bg-white/[0.06] text-white"
                        : "border border-transparent bg-transparent text-white/70 hover:bg-white/[0.04]",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#141414] px-4 py-4">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
                <span>Czas · min</span>
                <span>wpisz albo ±5</span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Mniej minut"
                  onClick={() => setMinutesText(String(clampMinutes(minutes - 5)))}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minutesText}
                  onChange={(e) => setMinutesText(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => setMinutesText(String(minutes))}
                  aria-label="Minuty cardio"
                  className="h-14 w-24 rounded-xl border border-[var(--gym-gold)]/40 bg-black/40 text-center font-display text-4xl tabular-nums text-[var(--gym-gold)] outline-none focus:border-[var(--gym-gold)]"
                />
                <button
                  type="button"
                  aria-label="Więcej minut"
                  onClick={() => setMinutesText(String(clampMinutes(minutes + 5)))}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Dystans (km)
                </span>
                <input
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  inputMode="decimal"
                  placeholder="np. 3,5"
                  className="mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[rgba(var(--neon-rgb),0.45)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Śr. tętno
                </span>
                <input
                  value={avgHr}
                  onChange={(e) => setAvgHr(e.target.value)}
                  inputMode="numeric"
                  placeholder="np. 125"
                  className="mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-[#121212] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[rgba(var(--neon-rgb),0.45)]"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Notatka
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="np. pod górkę, 6% nachylenia"
                className="mt-1.5 w-full resize-none rounded-xl border border-white/12 bg-[#121212] px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[rgba(var(--neon-rgb),0.45)]"
              />
            </label>
          </div>

          <div className="shrink-0 border-t border-white/10 bg-[#0c0c0c] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={pending}
              className="gold-btn inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold disabled:opacity-60"
            >
              <Flame className="h-5 w-5" />
              {pending ? "Zapisuję…" : `Zapisz ${minutes} min`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

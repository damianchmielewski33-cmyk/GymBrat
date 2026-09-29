"use client";

import { Trophy } from "lucide-react";
import { PrAchievementGraphic } from "@/components/reports/pr-achievement-graphic";
import type { NewMaxHit } from "@/lib/session-new-max";
import { SessionChromeHeader } from "@/components/active-workout/session-chrome";

type WorkoutFinishedScreenProps = {
  title: string;
  elapsedSeconds: number;
  setsDone: number;
  setsTotal: number;
  volumeKg: number;
  onDone: () => void;
  onReturn: () => void;
  onClose?: () => void;
  saving?: boolean;
  newMaxLabel?: string | null;
  newMaxHit?: NewMaxHit | null;
};

function formatElapsed(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function WorkoutFinishedScreen({
  title,
  elapsedSeconds,
  setsDone,
  setsTotal,
  volumeKg,
  onDone,
  onReturn,
  onClose,
  saving,
  newMaxLabel,
  newMaxHit,
}: WorkoutFinishedScreenProps) {
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--gym-black)]">
      <SessionChromeHeader
        title={title}
        subtitle={`${formatElapsed(elapsedSeconds)} · ${setsDone}/${setsTotal} serii`}
        onClose={onClose ?? onReturn}
        listDisabled
        className="py-3"
      />

      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-16">
        {newMaxHit ? (
          <div className="mt-2 w-full max-w-sm">
            <PrAchievementGraphic
              exerciseName={newMaxHit.exerciseName}
              valueKg={newMaxHit.value}
            />
          </div>
        ) : (
          <>
            <div className="mt-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/50 bg-[var(--gym-surface-sunken)]">
              <Trophy className="h-12 w-12 text-[var(--gym-gold)]" />
            </div>
            <h1 className="mt-6 text-center text-3xl font-semibold text-white">
              Trening zrobiony
            </h1>
            {newMaxLabel ? (
              <p className="mt-3 rounded-full border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
                NOWY MAX · {newMaxLabel}
              </p>
            ) : null}
          </>
        )}

        {newMaxHit ? (
          <h1 className="mt-5 text-center text-2xl font-semibold text-white">
            Trening zrobiony
          </h1>
        ) : null}

        <div className="app-card mt-6 grid w-full max-w-sm grid-cols-3 divide-x divide-white/10 py-4">
          <div className="px-2 text-center">
            <p className="app-label text-[var(--gym-gold)]">Czas</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-white">
              {minutes}
              <span className="text-sm text-white/50"> min</span>
            </p>
          </div>
          <div className="px-2 text-center">
            <p className="app-label text-[var(--gym-gold)]">Serie</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-white">{setsDone}</p>
          </div>
          <div className="px-2 text-center">
            <p className="app-label text-[var(--gym-gold)]">Tonaż</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-white">
              {Math.round(volumeKg)}
              <span className="text-sm text-white/50"> kg</span>
            </p>
          </div>
        </div>

        {setsDone === 0 ? (
          <p className="mt-3 text-sm text-white/45">Brak zaliczonych serii.</p>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={onDone}
          className="gym-btn-primary mt-8 inline-flex h-14 w-full max-w-sm shrink-0 items-center justify-center rounded-2xl text-base font-semibold disabled:opacity-60"
        >
          {saving ? "Zapisuję…" : "Gotowe"}
        </button>
        <button
          type="button"
          onClick={onReturn}
          className="mt-4 shrink-0 text-sm text-white/70 hover:text-white"
        >
          Wróć do treningu
        </button>
      </div>
    </div>
  );
}

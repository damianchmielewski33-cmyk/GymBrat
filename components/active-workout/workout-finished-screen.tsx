"use client";

import { Trophy, X, List } from "lucide-react";

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
}: WorkoutFinishedScreenProps) {
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black">
      <header className="flex items-center justify-between gap-2 px-3 py-3">
        <button
          type="button"
          onClick={onClose ?? onReturn}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/80"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            {title}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-white/70">
            {formatElapsed(elapsedSeconds)} · {setsDone}/{setsTotal} serii
          </p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/40">
          <List className="h-4 w-4" />
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/50 bg-[#141414]">
          <Trophy className="h-12 w-12 text-[var(--gym-gold)]" />
        </div>
        <h1 className="mt-6 text-center text-3xl font-semibold text-white">Trening zrobiony</h1>

        <div className="mt-8 grid w-full max-w-sm grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/[0.08] bg-[#161616] py-4">
          <div className="px-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]">
              Czas
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-white">
              {minutes}
              <span className="text-sm text-white/50"> min</span>
            </p>
          </div>
          <div className="px-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]">
              Serie
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-white">{setsDone}</p>
          </div>
          <div className="px-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]">
              Tonaż
            </p>
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
          className="gold-btn mt-10 inline-flex h-14 w-full max-w-sm items-center justify-center rounded-2xl text-base font-semibold disabled:opacity-60"
        >
          {saving ? "Zapisuję…" : "Gotowe"}
        </button>
        <button
          type="button"
          onClick={onReturn}
          className="mt-4 font-mono text-sm text-white/70 hover:text-white"
        >
          Wróć do treningu
        </button>
      </div>
    </div>
  );
}

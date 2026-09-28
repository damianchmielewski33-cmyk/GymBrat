"use client";

import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";

type NewMaxPayload = {
  kind: "e1rm" | "weight" | "first";
  exerciseName: string;
  weight: number;
  reps: number;
};

/** Pełnoekranowe świętowanie NOWY MAX po rekordzie w sesji. */
export function NewMaxCelebration({
  payload,
  onClose,
}: {
  payload: NewMaxPayload | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!payload) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onClose();
    }, 4200);
    return () => window.clearTimeout(t);
  }, [payload, onClose]);

  if (!payload || !visible) return null;

  const label =
    payload.kind === "first"
      ? "Pierwszy zapis"
      : payload.kind === "e1rm"
        ? "NOWY MAX e1RM"
        : "NOWY MAX ciężaru";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#d4af37]/35 bg-gradient-to-b from-[#2a2210] to-[#0c0c0e] p-8 text-center shadow-[0_0_60px_rgba(212,175,55,0.25)]">
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:text-white"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d4af37]/40 bg-[#d4af37]/15 text-[#d4af37]">
          <Trophy className="h-7 w-7" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d4af37]">
          {label}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-semibold text-white">
          {payload.exerciseName}
        </h2>
        <p className="mt-3 text-lg tabular-nums text-white/85">
          {payload.reps} × {payload.weight} kg
        </p>
      </div>
    </div>
  );
}

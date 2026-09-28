"use client";

import { Menu, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactClock, formatKgPl } from "@/lib/session-cursor";

const REST_CHIPS = [60, 90, 120, 180] as const;

export function SessionRestScreen({
  title,
  elapsedSeconds,
  doneSets,
  totalSets,
  remaining,
  remember,
  muted,
  lastLine,
  nextLabel,
  nextKind,
  onClose,
  onOpenList,
  onPickDuration,
  onRememberToggle,
  onMuteToggle,
  onAddThirty,
  onContinue,
}: {
  title: string;
  elapsedSeconds: number;
  doneSets: number;
  totalSets: number;
  remaining: number;
  remember: boolean;
  muted: boolean;
  lastLine: string;
  nextLabel: string;
  nextKind: "set" | "exercise" | "finish";
  onClose: () => void;
  onOpenList: () => void;
  onPickDuration: (seconds: number) => void;
  onRememberToggle: () => void;
  onMuteToggle: () => void;
  onAddThirty: () => void;
  onContinue: () => void;
}) {
  const pct = totalSets > 0 ? Math.min(100, (doneSets / totalSets) * 100) : 0;
  const selected =
    REST_CHIPS.find((s) => remaining > 0 && Math.abs(remaining - s) < 2) ??
    REST_CHIPS.reduce((best, s) => (Math.abs(s - remaining) < Math.abs(best - remaining) ? s : best), REST_CHIPS[1]);

  const nextCaption =
    nextKind === "exercise" ? "Następne ćwiczenie" : nextKind === "finish" ? "Koniec" : "Następna seria";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/70"
          aria-label="Zamknij"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {title}
          </p>
          <p className="mt-0.5 text-[12px] tabular-nums text-white/55">
            {formatCompactClock(elapsedSeconds)} · {doneSets}/{totalSets} serii
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenList}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/70"
          aria-label="Lista ćwiczeń"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#d4af37]" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center pt-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-white/40">Przerwa</p>
        <p className="font-heading mt-2 text-[5.25rem] leading-none font-semibold tabular-nums text-[#e8c547]">
          {formatCompactClock(remaining)}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {REST_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPickDuration(s)}
              className={cn(
                "h-11 min-w-[4.25rem] rounded-full border px-4 text-sm font-semibold tabular-nums",
                selected === s
                  ? "border-[#d4af37] bg-[#d4af37]/15 text-[#e8c547]"
                  : "border-white/15 bg-transparent text-white/70",
              )}
            >
              {formatCompactClock(s)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRememberToggle}
          className={cn(
            "mt-4 text-[10px] font-semibold uppercase tracking-[0.16em]",
            remember ? "text-white/55" : "text-white/30",
          )}
        >
          {remember ? "Zapamiętam przy tym ćwiczeniu" : "Nie zapamiętuję przerwy"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Zaliczone</p>
        <p className="mt-1 text-[15px] leading-snug text-white/90">{lastLine}</p>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {nextCaption}
        </p>
        <p className="mt-1 text-lg font-semibold text-white">{nextLabel}</p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onAddThirty}
          className="flex h-14 w-16 items-center justify-center rounded-2xl border border-white/15 text-sm font-semibold text-white/80"
        >
          +30 s
        </button>
        <button
          type="button"
          onClick={onMuteToggle}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 text-white/80"
          aria-label={muted ? "Włącz dźwięk" : "Wycisz"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-[15px] font-semibold text-[#1a1408]"
        >
          <PlayIcon />
          Dalej
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function formatCompletedSetLine(name: string, setIndex: number, weight: number, reps: number | null) {
  const r = reps == null ? "—" : String(reps);
  return `${name} · seria ${setIndex + 1}: ${formatKgPl(weight)} kg × ${r}`;
}

"use client";

import { useEffect, useState } from "react";
import { markCelebrationSeenAction } from "@/actions/challenges";
import type { CelebrationPayload } from "@/lib/community/challenges";
import { cn } from "@/lib/utils";

export function ChallengeCelebrationOverlay({
  celebrations,
}: {
  celebrations: CelebrationPayload[];
}) {
  const [queue, setQueue] = useState(celebrations);
  const current = queue[0] ?? null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setQueue(celebrations);
  }, [celebrations]);

  useEffect(() => {
    if (!current) return;
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [current?.claimId]);

  if (!current) return null;

  const dismiss = async () => {
    setVisible(false);
    await markCelebrationSeenAction(current.claimId);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setVisible(false);
    }, 280);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal
      aria-label="Celebracja wyzwania"
    >
      {/* Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 animate-[challenge-confetti_2.4s_ease-out_infinite] rounded-sm bg-[var(--gym-gold)]"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${-10 - (i % 5) * 4}%`,
              animationDelay: `${(i % 8) * 0.12}s`,
              opacity: 0.35 + (i % 5) * 0.1,
              transform: `rotate(${i * 15}deg)`,
            }}
          />
        ))}
      </div>

      <div
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-[var(--gym-gold)]/40 bg-gradient-to-b from-[#1a1610] to-[#0a0a0c] p-6 text-center shadow-[0_0_80px_rgba(212,175,55,0.25)] transition-all duration-500",
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-6",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--gym-gold)] to-transparent" />

        <p className="app-label text-[var(--gym-gold)]">Wyzwanie ukończone</p>

        <div className="mx-auto mt-4 flex h-24 w-24 animate-[challenge-pop_0.7s_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-[2rem] border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/15 text-5xl shadow-[0_0_40px_rgba(212,175,55,0.35)]">
          {current.emoji}
        </div>

        <h2 className="mt-5 font-heading text-[26px] font-semibold leading-tight text-white">
          {current.title}
        </h2>
        {current.rewardTitle ? (
          <p className="mt-2 text-[14px] text-[var(--gym-gold)]">
            Odznaka: {current.badgeEmoji} {current.rewardTitle}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-white/40">XP</p>
            <p className="font-metric text-[22px] text-[var(--gym-gold)]">
              +{current.xpAwarded}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-white/40">
              Poziom
            </p>
            <p className="font-metric text-[22px] text-white">{current.level}</p>
          </div>
        </div>

        <p className="mt-3 text-[12px] text-white/45">
          Łącznie {current.xpTotal.toLocaleString("pl-PL")} XP w społeczności
        </p>

        <button
          type="button"
          onClick={() => void dismiss()}
          className="mt-6 w-full rounded-2xl bg-[var(--gym-gold)] py-3.5 text-[14px] font-bold text-black transition hover:brightness-110"
        >
          Dalej, brat
        </button>
      </div>
    </div>
  );
}

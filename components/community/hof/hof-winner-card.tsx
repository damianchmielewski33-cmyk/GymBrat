"use client";

import Link from "next/link";
import type { HofCategoryBoard, HofLeader } from "@/lib/community/hof-types";
import { HOF_CATEGORY_META } from "@/lib/community/hof-types";

export function HofWinnerCard({
  board,
  champion,
  delayMs = 0,
}: {
  board: HofCategoryBoard;
  champion: HofLeader;
  delayMs?: number;
}) {
  const meta = HOF_CATEGORY_META[board.category];
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 shadow-[0_0_40px_-12px_rgba(235,196,74,0.35)] transition duration-500 hover:border-[var(--gym-gold)]/40"
      style={{
        animation: `hofCardIn 0.55s ease-out ${delayMs}ms both`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(235,196,74,0.12),transparent_50%)] opacity-80 transition group-hover:opacity-100" />
      <div className="relative">
        <p className="text-[11px] uppercase tracking-wide text-white/40">
          {board.emoji} {board.label}
        </p>
        <h3 className="mt-2 font-heading text-[20px] font-semibold text-white">
          {champion.displayName}
        </h3>
        <p className={`mt-1 text-[13px] font-medium ${meta.accentClass}`}>
          {champion.scoreLabel}
        </p>
        <Link
          href={`/community/u/${champion.userId}`}
          className="mt-3 inline-flex text-[12px] text-white/45 underline-offset-2 hover:text-white hover:underline"
        >
          Profil
        </Link>
      </div>
      <style jsx>{`
        @keyframes hofCardIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </article>
  );
}

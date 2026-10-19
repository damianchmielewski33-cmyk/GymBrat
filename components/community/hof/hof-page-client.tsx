"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, Crown } from "lucide-react";
import { HofBadgeGallery } from "@/components/community/hof/hof-badge-gallery";
import { HofCategoryPodium } from "@/components/community/hof/hof-category-podium";
import { HofPeriodTabs } from "@/components/community/hof/hof-period-tabs";
import { HofSeasonArchive } from "@/components/community/hof/hof-season-archive";
import { HofWinnerCard } from "@/components/community/hof/hof-winner-card";
import { HofWinnersHistory } from "@/components/community/hof/hof-winners-history";
import type { HofPageData } from "@/lib/community/hof";
import {
  HOF_PERIOD_LABELS,
  type HofPeriodKind,
} from "@/lib/community/hof-types";

export function HofPageClient({
  initial,
  kind,
}: {
  initial: HofPageData;
  kind: HofPeriodKind;
}) {
  const router = useRouter();

  useEffect(() => {
    void import("@/lib/analytics/track")
      .then(({ track }) => {
        track.hofViewed("anonymous", {
          season_key: initial.period.key,
          team_id: null,
        });
      })
      .catch(() => undefined);
  }, [initial.period.key, kind]);

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Community
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/25 bg-gradient-to-br from-[var(--gym-gold)]/15 via-black/40 to-transparent p-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--gym-gold)]/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <Crown className="mt-1 h-7 w-7 text-[var(--gym-gold)]" aria-hidden />
          <div>
            <p className="app-label text-[var(--gym-gold)]">Galeria sławy</p>
            <h1 className="mt-1 font-heading text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
              {initial.period.title}
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/50">
              {initial.archived
                ? "Oficjalne podium tego okresu — zwycięzcy zapisani na stałe."
                : "Na żywo: liderzy kategorii. Po zamknięciu okresu wyniki trafiają do archiwum."}
            </p>
          </div>
        </div>
      </header>

      <HofPeriodTabs
        kind={kind}
        onChange={(k) => router.push(`/community/hall-of-fame?period=${k}`)}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initial.boards.map((board, i) => {
          const champ = board.leaders[0];
          if (!champ) return null;
          return (
            <HofWinnerCard
              key={board.category}
              board={board}
              champion={champ}
              delayMs={i * 60}
            />
          );
        })}
      </section>

      <div className="space-y-4">
        {initial.boards.map((board) => (
          <HofCategoryPodium key={`podium-${board.category}`} board={board} />
        ))}
      </div>

      <HofWinnersHistory historyByCategory={initial.historyByCategory} />
      <HofBadgeGallery badges={initial.viewerBadges} />
      <HofSeasonArchive archive={initial.archive} />

      <p className="text-center text-[11px] text-white/35">
        Okres: {HOF_PERIOD_LABELS[kind]} · klucz {initial.period.key}
      </p>
    </div>
  );
}

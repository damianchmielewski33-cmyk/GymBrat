"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarX, Dumbbell } from "lucide-react";
import { AppPageHeader } from "@/components/layout/screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkoutHistoryFilters } from "@/components/workout-history/workout-history-filters";
import { WorkoutHistoryLimitBanner } from "@/components/workout-history/workout-history-limit-banner";
import { WorkoutHistorySessionCard } from "@/components/workout-history/workout-history-session-card";
import { WorkoutHistoryStats } from "@/components/workout-history/workout-history-stats";
import {
  groupByWeek,
  WorkoutHistoryWeekGroup,
} from "@/components/workout-history/workout-history-week-group";
import { useWorkoutHistoryFilter } from "@/components/workout-history/use-workout-history-filter";
import {
  computeHistoryKpis,
  type WorkoutHistoryOverview,
} from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

type Props = {
  overview: WorkoutHistoryOverview;
  initialPlanKey?: string | null;
  initialOpenId?: string | null;
};

function workoutsWord(n: number): string {
  if (n === 1) return "trening";
  if (n >= 2 && n <= 4) return "treningi";
  return "treningów";
}

export function WorkoutHistoryView({
  overview,
  initialPlanKey,
  initialOpenId,
}: Props) {
  const router = useRouter();
  const { cards, planFilters, sessionsLimitReached, kpis: serverKpis } =
    overview;
  const knownPlanIds = useMemo(
    () => planFilters.map((p) => p.id),
    [planFilters],
  );

  const { filterPlanKey, setFilterPlanKey, openId, clearOpen } =
    useWorkoutHistoryFilter({
      initialPlanKey,
      initialOpenId,
      knownPlanIds,
    });

  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [userExpandedIds, setUserExpandedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleCards = useMemo(
    () => cards.filter((c) => !removedIds.has(c.id)),
    [cards, removedIds],
  );

  const filtered = useMemo(() => {
    if (filterPlanKey === "all") return visibleCards;
    return visibleCards.filter((c) => c.planCompareKey === filterPlanKey);
  }, [visibleCards, filterPlanKey]);

  const kpis = useMemo(() => {
    if (filterPlanKey === "all" && removedIds.size === 0) {
      return serverKpis;
    }
    return computeHistoryKpis(filtered);
  }, [filterPlanKey, filtered, removedIds.size, serverKpis]);

  const weekGroups = useMemo(() => groupByWeek(filtered), [filtered]);

  const expandedIds = useMemo(() => {
    const next = new Set(userExpandedIds);
    if (openId && visibleCards.some((c) => c.id === openId)) {
      next.add(openId);
    }
    return next;
  }, [userExpandedIds, openId, visibleCards]);

  const highlightId =
    openId && visibleCards.some((c) => c.id === openId) ? openId : null;

  const totalVisible = visibleCards.length;
  const shownCount = filtered.length;
  const scopeLabel =
    filterPlanKey === "all"
      ? "Wszystkie treningi"
      : (planFilters.find((p) => p.id === filterPlanKey)?.label ??
        "Wszystkie treningi");

  const headerMeta =
    filterPlanKey === "all"
      ? `${totalVisible} ${workoutsWord(totalVisible)} w historii`
      : `${shownCount} z ${totalVisible} ${workoutsWord(totalVisible)}`;

  const liveAnnouncement = `Statystyki: ${scopeLabel}. ${
    shownCount === 0
      ? "Brak danych"
      : `${kpis.avgWorkoutsPerWeekLast8} na tydzień, ${
          kpis.avgDurationMinutes ?? "—"
        } min, ${(kpis.tonnageTotalKg / 1000).toFixed(1).replace(".", ",")} t`
  }.`;

  const onHighlightDone = useCallback(() => {
    clearOpen();
  }, [clearOpen]);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/workout-plan");
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
        <BackLink onClick={handleBack} />
        <AppPageHeader kicker="Trening" title="Historia treningów" />
        <div className="app-card mt-4 border border-white/[0.08] px-5 py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]">
            <Dumbbell className="h-8 w-8" aria-hidden />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold text-white">
            Nie masz jeszcze treningów
          </h3>
          <p className="mt-2 text-[14px] leading-5 text-white/80">
            Ukończony trening pojawi się tutaj z ciężarami i tonażem.
          </p>
          <Link
            href="/workout-plan"
            className={cn(buttonVariants({ variant: "cta" }), "mt-5 w-full")}
          >
            Przejdź do Treningów
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-1 pb-10 md:max-w-xl">
      <BackLink onClick={handleBack} />

      <AppPageHeader
        kicker="Trening"
        title="Historia treningów"
        description={
          <span className="tabular-nums text-[var(--gym-text-secondary)]">
            {headerMeta}
          </span>
        }
      />

      <div className="mt-4">
        <WorkoutHistoryStats
          kpis={kpis}
          scopeLabel={scopeLabel}
          sessionsLimitReached={sessionsLimitReached}
          empty={shownCount === 0}
          liveAnnouncement={liveAnnouncement}
        />
        <WorkoutHistoryLimitBanner visible={sessionsLimitReached} />
      </div>

      <WorkoutHistoryFilters
        planFilters={planFilters}
        filterPlanKey={filterPlanKey}
        onChange={setFilterPlanKey}
        totalCount={totalVisible}
        shownCount={shownCount}
      />

      {shownCount === 0 ? (
        <div className="app-card mt-4 border border-white/[0.08] px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]">
            <CalendarX className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold text-white">
            Brak treningów dla „{scopeLabel}”
          </h3>
          <p className="mt-2 text-[14px] leading-5 text-white/80">
            Ten dzień planu nie ma jeszcze zapisanych treningów albo wszystkie
            usunięto.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 h-12 w-full"
            onClick={() => setFilterPlanKey("all")}
          >
            Pokaż wszystkie
          </Button>
        </div>
      ) : (
        <div>
          {weekGroups.map((week) => (
            <WorkoutHistoryWeekGroup key={week.monday} week={week}>
              {week.cards.map((card) => (
                <WorkoutHistorySessionCard
                  key={card.id}
                  card={card}
                  expanded={expandedIds.has(card.id)}
                  highlight={highlightId === card.id}
                  onToggle={() => {
                    const isOpen = expandedIds.has(card.id);
                    if (isOpen && openId === card.id) clearOpen();
                    setUserExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (isOpen) next.delete(card.id);
                      else next.add(card.id);
                      return next;
                    });
                  }}
                  onDeleted={(id) =>
                    setRemovedIds((prev) => {
                      const next = new Set(prev);
                      next.add(id);
                      return next;
                    })
                  }
                  onHighlightDone={onHighlightDone}
                />
              ))}
            </WorkoutHistoryWeekGroup>
          ))}
        </div>
      )}

      {sessionsLimitReached ? (
        <p className="mt-6 text-center text-[12px] text-[var(--gym-text-secondary)]">
          Pokazano 400 ostatnich treningów.
        </p>
      ) : null}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm text-white/80"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Wróć
    </button>
  );
}

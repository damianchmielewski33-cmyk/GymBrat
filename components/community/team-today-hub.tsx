"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Dumbbell,
  Flame,
  Heart,
  Lock,
  Settings2,
  Trophy,
} from "lucide-react";
import { saveTeamRankingConsentAction } from "@/actions/team-ranking-consent";
import { WarLeagueBadge } from "@/components/community/wars/war-league-badge";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TeamTodayHub } from "@/lib/community/team-hub";
import { cn } from "@/lib/utils";

function RingSvg({
  progress,
  color,
  size,
  stroke,
}: {
  progress: number;
  color: string;
  size: number;
  stroke: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, progress));
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  );
}

export function TeamTodayHubView({ hub }: { hub: TeamTodayHub }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [consentOpen, setConsentOpen] = useState(false);
  const [rankingChecked, setRankingChecked] = useState(hub.consents.teamRanking);
  const [cardioChecked, setCardioChecked] = useState(hub.consents.teamCardio);
  const [pending, startTransition] = useTransition();

  const trainingPct =
    hub.rings.training.target > 0
      ? hub.rings.training.current / hub.rings.training.target
      : 0;
  const cardioPct =
    hub.rings.cardio.target > 0
      ? hub.rings.cardio.current / hub.rings.cardio.target
      : 0;

  function openConsent() {
    setRankingChecked(hub.consents.teamRanking);
    setCardioChecked(hub.consents.teamCardio);
    setConsentOpen(true);
  }

  function saveConsent() {
    startTransition(async () => {
      const res = await saveTeamRankingConsentAction({
        teamId: hub.teamId,
        teamRanking: rankingChecked,
        teamCardio: cardioChecked,
        source: "team_hub",
      });
      if (!res.ok) {
        notifyError(res.error);
        if (res.needDisplayName) {
          router.push("/profile");
        }
        return;
      }
      setConsentOpen(false);
      notifySaved(
        rankingChecked
          ? "Zapisano Twój udział w rankingu."
          : "Nie bierzesz już udziału w rankingu grupy.",
      );
      router.refresh();
    });
  }

  const positionCard = (() => {
    if (!hub.ranking.consentGranted) {
      return (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-heading text-[22px] font-semibold text-white">
                {hub.ranking.consentWithdrawn
                  ? "Nie bierzesz udziału w rankingu grupy"
                  : "Dołącz do rankingu grupy"}
              </p>
              <p className="mt-1 text-[13px] text-white/55">
                {hub.ranking.consentWithdrawn
                  ? "Nadal widzisz tablicę i możesz trenować z grupą."
                  : "Zobacz, jak wypadasz na tle grupy w tym tygodniu."}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70"
              aria-label="Ustawienia udziału w rankingu"
              onClick={openConsent}
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
          <Button type="button" className="w-full" onClick={openConsent}>
            {hub.ranking.consentWithdrawn ? "Dołącz ponownie" : "Dołącz do rankingu grupy"}
          </Button>
        </div>
      );
    }

    if (hub.memberCount <= 1) {
      return (
        <div className="space-y-2">
          <p className="font-heading text-[22px] font-semibold text-white">
            Zaproś kogoś, aby zobaczyć ranking tygodnia
          </p>
          <p className="text-[13px] text-white/55">{hub.ranking.tip}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-metric text-[42px] leading-none text-[var(--gym-gold)] tabular-nums">
              {hub.ranking.rank != null ? `${hub.ranking.rank}.` : "—"}
            </p>
            <p className="mt-1 text-[13px] text-white/55">
              miejsce
              {hub.ranking.total > 0
                ? ` z ${hub.ranking.total} w tym tygodniu`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70"
            aria-label="Ustawienia udziału w rankingu"
            onClick={openConsent}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
        <p className="text-[14px] leading-snug text-white/80">{hub.ranking.tip}</p>
        {hub.ranking.gapToNext ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--gym-gold)]"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    8,
                    100 -
                      (hub.ranking.gapToNext.delta /
                        Math.max(1, hub.ranking.gapToNext.score)) *
                        100,
                  ),
                )}%`,
              }}
            />
          </div>
        ) : null}
      </div>
    );
  })();

  return (
    <section className="app-card space-y-3 p-4" aria-labelledby="team-today-heading">
      <SectionLabel title="Dziś w zespole" titleAs="h2" />
      <h2 id="team-today-heading" className="sr-only">
        Dziś w zespole
      </h2>

      <div
        className="rounded-2xl border border-[var(--gym-gold)]/25 p-4"
        style={{
          background:
            "linear-gradient(145deg, rgba(212,175,55,0.16) 0%, rgba(8,8,8,0.92) 70%)",
        }}
      >
        {positionCard}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]">
            Tydzień w pierścieniach
          </p>
          <p className="text-[11px] text-white/40">Poniedziałek–niedziela</p>
        </div>
        <div
          className="flex items-center gap-4"
          role="img"
          aria-label={`Trening: ${hub.rings.training.current} z ${hub.rings.training.target}, Cardio: ${hub.rings.cardio.current} z ${hub.rings.cardio.target} minut`}
        >
          <div className="relative h-[120px] w-[120px] shrink-0">
            <div className="absolute inset-0 flex items-center justify-center">
              <RingSvg
                progress={trainingPct}
                color="var(--gym-gold)"
                size={120}
                stroke={10}
              />
            </div>
            <div className="absolute inset-[14px] flex items-center justify-center">
              <RingSvg
                progress={cardioPct}
                color="var(--gym-success)"
                size={92}
                stroke={8}
              />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <Dumbbell className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
              <Heart className="h-3.5 w-3.5 text-[var(--gym-success)]" aria-hidden />
            </div>
            {hub.rings.training.closed || hub.rings.cardio.closed ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-[var(--gym-success)] px-1.5 py-0.5 text-[10px] font-semibold text-black motion-safe:animate-pulse">
                ✓
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-[13px]">
            <div>
              <p className="font-medium text-white">Trening</p>
              <p className="tabular-nums text-white/60">
                {hub.rings.training.current} z {hub.rings.training.target}
                {hub.rings.training.closed ? " · Cel zrealizowany" : ""}
              </p>
            </div>
            <div>
              <p className="font-medium text-white">Cardio</p>
              <p className="tabular-nums text-white/60">
                {hub.rings.cardio.current} z {hub.rings.cardio.target} min
                {hub.rings.cardio.closed ? " · Cel zrealizowany" : ""}
              </p>
            </div>
            {hub.rings.training.usingDefaultTarget ||
            hub.rings.cardio.usingDefaultTarget ? (
              <p className="text-[11px] text-white/40">
                Używamy domyślnego celu.{" "}
                <Link href="/profile" className="text-[var(--gym-gold)] underline">
                  Zmień w profilu
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]">
          Poziomy
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Ty", hub.levels.user],
              ["Grupa", hub.levels.team],
            ] as const
          ).map(([label, lvl]) => (
            <div key={label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-white/50">{label}</span>
                <span className="font-metric text-[18px] text-white tabular-nums">
                  Lv. {lvl.level}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--gym-gold)]"
                  style={{ width: `${Math.min(100, lvl.pct)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-white/40 tabular-nums">
                {lvl.intoLevel} / {lvl.needForNext} XP do poziomu {lvl.level + 1}
              </p>
            </div>
          ))}
        </div>
        <Link
          href="/community/challenges"
          className="mt-3 inline-block text-[12px] text-[var(--gym-gold)] underline"
        >
          Szczegóły poziomu
        </Link>
      </div>

      <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
        <Flame className="h-5 w-5 shrink-0 text-[var(--gym-gold)]" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] text-white">
            {hub.ranking.streakWeeks > 0
              ? `${hub.ranking.streakWeeks} tyg. z rzędu z treningiem`
              : "Zacznij serię — zrób trening w tym tygodniu"}
          </p>
          {hub.ranking.atRiskThisWeek ? (
            <p className="text-[12px] text-white/55">
              Zrób dziś trening, by nie przerwać serii
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]">
          Misja tygodnia
        </p>
        {hub.mission ? (
          <>
            <p className="text-[15px] font-medium text-white">
              {hub.mission.quest.emoji} {hub.mission.quest.title}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={hub.mission.pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  hub.mission.pct >= 100
                    ? "bg-[var(--gym-success)]"
                    : "bg-[var(--gym-gold)]",
                )}
                style={{ width: `${hub.mission.pct}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-white/50 tabular-nums">
              {hub.mission.total} z {hub.mission.quest.targetValue}{" "}
              {hub.mission.quest.unitLabel}
            </p>
            {hub.memberCount < 3 ? (
              <p className="mt-2 text-[12px] text-white/45">
                Misje zespołowe działają najlepiej w grupie 3+ osób. Zaproś kogoś,
                aby przyspieszyć.
              </p>
            ) : null}
            <Link
              href={`/community/teams/${hub.teamId}/quests`}
              className="mt-2 inline-block text-[12px] text-[var(--gym-gold)] underline"
            >
              Szczegóły misji
            </Link>
          </>
        ) : (
          <p className="text-[13px] text-white/50">
            Brak aktywnej misji w tym tygodniu.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <WarLeagueBadge league={hub.war.league} />
            <span className="text-[12px] text-white/50 tabular-nums">
              {hub.war.lp} LP
            </span>
          </div>
          <Link
            href="/community/wars"
            className="inline-flex h-10 min-h-10 items-center justify-center rounded-xl border border-white/15 px-3.5 text-[0.8rem] font-semibold text-white/80"
          >
            Zobacz wojny
          </Link>
        </div>
        {!hub.war.hasPlayed ? (
          <p className="mt-2 text-[12px] text-white/45">
            Jeszcze nie graliście. Dołączcie do kolejki wojny.
          </p>
        ) : null}
      </div>

      <Link
        href={`/community/teams/${hub.teamId}/badges`}
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          <span className="text-[14px] text-white">
            Odznaki · {hub.badges.unlockedCount}/{hub.badges.totalCount} zdobytych
          </span>
        </div>
        <span className="text-white/40">→</span>
      </Link>

      <Sheet open={consentOpen} onOpenChange={setConsentOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Udział w rankingu grupy</SheetTitle>
            <SheetDescription>
              Członkowie grupy {hub.teamName} zobaczą w rankingu tygodniowym: Twój
              pseudonim, liczbę treningów w tygodniu, serie tygodni, postęp siły w
              procentach względem Twoich wcześniejszych wyników oraz XP i odznaki.
              Nikt spoza grupy tych danych nie zobaczy. Nie pokażemy innym Twojej
              wagi, pomiarów, zdjęć, posiłków, tętna ani kalorii.
            </SheetDescription>
          </SheetHeader>
          {!hub.hasDisplayName ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/70">
              Najpierw ustaw pseudonim w{" "}
              <Link href="/profile" className="text-[var(--gym-gold)] underline">
                profilu
              </Link>
              .
            </p>
          ) : null}
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={rankingChecked}
              onChange={(e) => {
                setRankingChecked(e.target.checked);
                if (!e.target.checked) setCardioChecked(false);
              }}
              disabled={!hub.hasDisplayName}
            />
            <span className="text-[14px] text-white">
              Biorę udział w rankingu grupy (opcjonalne)
            </span>
          </label>
          <label
            className={cn(
              "mt-3 flex min-h-11 items-start gap-3",
              rankingChecked ? "cursor-pointer" : "opacity-40",
            )}
          >
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={cardioChecked}
              disabled={!rankingChecked || !hub.hasDisplayName}
              onChange={(e) => setCardioChecked(e.target.checked)}
            />
            <span className="text-[14px] text-white">
              Pokazuj też minuty cardio (osobna zgoda, opcjonalna)
            </span>
          </label>
          <Button
            type="button"
            className="mt-5 w-full"
            disabled={pending || (rankingChecked && !hub.hasDisplayName)}
            onClick={saveConsent}
          >
            Zapisz
          </Button>
        </SheetContent>
      </Sheet>
    </section>
  );
}

export function BadgeCatalogClient({
  teamId,
  items,
  unlockedCount,
  totalCount,
  suggestedKey,
}: {
  teamId: string;
  items: Array<{
    definitionKey: string;
    category: string;
    title: string;
    emoji: string;
    description: string | null;
    targetValue: number | null;
    unitLabel: string | null;
    unlocked: boolean;
    unlockedAt: string | null;
    progress: number | null;
    rarityPct: number | null;
  }>;
  unlockedCount: number;
  totalCount: number;
  suggestedKey: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const filtered = items.filter((i) => {
    if (filter === "unlocked") return i.unlocked;
    if (filter === "locked") return !i.unlocked;
    return true;
  });
  const suggested = suggestedKey
    ? items.find((i) => i.definitionKey === suggestedKey)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Twoja kolekcja
        </p>
        <h1 className="font-heading text-[28px] font-semibold text-white">Odznaki</h1>
        <p className="mt-1 text-[13px] text-white/50">
          {unlockedCount} z {totalCount} zdobytych
        </p>
      </div>

      {unlockedCount === 0 && suggested ? (
        <div className="rounded-2xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 p-4">
          <p className="text-[14px] text-white">
            Zacznij od najprostszej: {suggested.emoji} {suggested.title}
          </p>
          <Link
            href="/treningi"
            className="mt-2 inline-flex h-10 min-h-10 items-center rounded-xl bg-[var(--gym-gold)] px-3.5 text-[0.8rem] font-semibold text-black"
          >
            Zacznij trening
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Wszystkie"],
            ["unlocked", `Zdobyte (${unlockedCount})`],
            ["locked", `Zablokowane (${totalCount - unlockedCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "min-h-11 rounded-full border px-3 text-[13px]",
              filter === key
                ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                : "border-white/15 text-white/60",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.map((b) => (
          <div
            key={b.definitionKey}
            className={cn(
              "relative min-h-[160px] rounded-2xl border p-3",
              b.unlocked
                ? "border-[var(--gym-gold)]/40 bg-black/40"
                : "border-dashed border-white/20 bg-black/20 opacity-70",
            )}
          >
            {!b.unlocked ? (
              <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-white/50" />
            ) : null}
            <div
              className={cn(
                "mx-auto flex h-16 w-16 items-center justify-center text-3xl",
                b.category === "team_quest"
                  ? "[clip-path:polygon(50%_0%,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)] bg-white/5"
                  : b.category === "hof"
                    ? "[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)] bg-white/5"
                    : "rounded-full bg-white/5",
              )}
            >
              {b.emoji}
            </div>
            <p className="mt-2 text-center text-[13px] font-medium text-white">
              {b.title}
            </p>
            <p className="mt-0.5 text-center text-[10px] uppercase tracking-wide text-white/40">
              {b.category === "team_quest"
                ? "Misja"
                : b.category === "hof"
                  ? "Galeria"
                  : b.category === "progression"
                    ? "Poziom"
                    : "Wyzwanie"}
            </p>
            {b.unlocked && b.unlockedAt ? (
              <p className="mt-1 text-center text-[11px] text-white/45">
                {new Date(b.unlockedAt).toLocaleDateString("pl-PL")}
              </p>
            ) : null}
            {!b.unlocked && b.targetValue != null ? (
              <p className="mt-1 text-center text-[11px] tabular-nums text-white/45">
                {b.progress ?? 0}/{b.targetValue}
                {b.unitLabel ? ` ${b.unitLabel}` : ""}
              </p>
            ) : null}
            {b.unlocked && b.rarityPct != null ? (
              <p className="mt-1 text-center text-[10px] text-[var(--gym-gold)]">
                Zdobyło {b.rarityPct}% osób
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <Link
        href={`/community/teams/${teamId}`}
        className="inline-flex text-[13px] text-white/55 underline"
      >
        Wróć do grupy
      </Link>
    </div>
  );
}

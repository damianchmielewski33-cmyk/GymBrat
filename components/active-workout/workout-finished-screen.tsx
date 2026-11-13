"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CloudOff,
  Flame,
  Loader2,
  Minus,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { FinishRing } from "@/components/active-workout/finish-ring";
import { SectionLabel } from "@/components/ui/section-label";
import type { WorkoutFinishedScreenData } from "@/components/active-workout/workout-finish-types";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { estimated1RM } from "@/lib/workout-history";
import { formatVolumeKg } from "@/lib/workout-session-calculations";
import {
  formatCountPl,
  formatDistanceKmPl,
  formatWeightRecordLine,
  formatWorkoutDurationPl,
} from "@/lib/workout-finish-format";
import { bestSetIndexInExercise } from "@/lib/workout-finish-sets-line";
import { formatHistoryShortDate } from "@/lib/workout-history-overview";
import {
  progressDeltaTone,
  readProgressDeltaUnitLocal,
  type ProgressDeltaUnit,
} from "@/lib/progress-delta-unit";
import { formatProgressDeltaPl } from "@/lib/workout-finish-delta-format";
import type { WorkoutPlanComparePayload } from "@/lib/workout-plan-compare";
import {
  patchWorkoutCardio,
  type CardioPatchInput,
} from "@/lib/workout-cardio-patch-submit";
import { cn } from "@/lib/utils";

function numOrEmpty(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n > 0 ? String(n) : "";
}

/** Skraca nazwy z planu (np. „(film w panelu)”) — mniej ucięć w liście. */
function displayExerciseName(name: string): string {
  return name
    .replace(/\s*\(\s*film[^)]*\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stopniowe odsłanianie sekcji: opóźnienie w ms liczone od startu ekranu. */
function rise(delayMs: number): React.CSSProperties {
  return { "--finish-delay": `${delayMs}ms` } as React.CSSProperties;
}

function toneClass(tone: "up" | "down" | "flat" | "none"): string {
  if (tone === "up") return "text-[var(--gym-trend-up)]";
  if (tone === "down") return "text-[var(--gym-trend-down)]";
  return "text-[var(--gym-text-secondary)]";
}

function DeltaChip({
  percent,
  absolute,
  unit,
  ariaLabelPrefix,
}: {
  percent: number | null;
  absolute: number | null;
  unit: ProgressDeltaUnit;
  ariaLabelPrefix: string;
}) {
  const tone = progressDeltaTone(unit, percent, absolute);
  // W-4 (005, przegląd ux 21.3): formatter lokalny dla tego ekranu (przecinek
  // dziesiętny, prawdziwy minus U+2212) — NIE współdzielony `formatProgressDelta`.
  const label = formatProgressDeltaPl({ unit, percent, absolute });
  if (tone === "none" || label == null) {
    return <span className="text-sm text-[var(--gym-text-secondary)]">—</span>;
  }
  const toneWord = tone === "up" ? "w górę" : tone === "down" ? "w dół" : "bez zmiany";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[14px] font-semibold tabular-nums",
        tone === "up" && "border-[var(--gym-trend-up)]/50 bg-[var(--gym-trend-up)]/12 text-[var(--gym-trend-up)]",
        tone === "down" && "border-[var(--gym-trend-down)]/65 bg-[var(--gym-trend-down)]/10 text-[var(--gym-trend-down)]",
        tone === "flat" && "border-[var(--gym-border-gold)] text-[var(--gym-text-secondary)]",
      )}
      aria-label={`${ariaLabelPrefix}: ${toneWord}${tone !== "flat" ? ` o ${label.replace(/^[+−-]/, "")}` : ""}`}
    >
      {tone === "up" ? (
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      ) : tone === "down" ? (
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Minus className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </span>
  );
}

/** Warianty karty „vs ostatnio” (005, sekcja 8.3.1) — jeden tekst na stan porównania. */
function volumeCaption(
  data: WorkoutFinishedScreenData,
  compare: WorkoutPlanComparePayload | null,
): string {
  if (data.saveStatus === "queued") {
    return "Porównanie będzie dostępne po wysłaniu treningu.";
  }
  // Trening wyłącznie z serii na masę ciała ma zawsze tonaż 0, mimo że serie SĄ
  // zaliczone (005 p.7) — rozróżniamy od realnego braku zaliczonych serii (D-06).
  if (data.setsDone === 0) {
    return "Brak zaliczonych serii.";
  }
  // BL-2 (005, przegląd ux 21.2/21.6): trening złożony z samych serii na masę ciała
  // ma tonaż 0 mimo zaliczonych serii — porównanie z poprzednim tonażem (> 0) dałoby
  // mylące −100%, więc tu zawsze „brak porównania”, niezależnie od `compare`.
  if (data.volumeKg === 0) {
    return "Ten trening nie ma tonażu (serie na masę ciała) — brak porównania.";
  }
  if (!compare) {
    return "Brak zapisanej sesji tego planu.";
  }
  if (compare.previousVolumeKg == null) {
    return "Pierwsza zapisana sesja tego planu — brak porównania.";
  }
  if (compare.previousVolumeKg <= 0) {
    return "Poprzednia sesja nie miała tonażu — brak porównania.";
  }
  return `wcześniej ${formatVolumeKg(compare.previousVolumeKg)} kg`;
}

function BestSetStat({
  weight,
  reps,
}: {
  weight: number;
  reps: number;
}) {
  if (weight <= 0) {
    return (
      <span className="whitespace-nowrap tabular-nums">
        {reps}
        <span className="font-normal text-[var(--gym-text-secondary)]"> powt.</span>
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatKgPl(weight)}
      <span className="font-normal text-white/60"> kg</span>
      <span className="mx-1 font-normal text-[var(--gym-text-secondary)]">×</span>
      {reps}
    </span>
  );
}

export function WorkoutFinishedScreen({
  data,
  onClose,
}: {
  data: WorkoutFinishedScreenData;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  /** Po intro (pierścień + znacznik) zaczyna narastać tonaż. */
  const [revealed, setRevealed] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [maxIndex, setMaxIndex] = useState<number | null>(null);
  const maxHit = maxIndex != null ? data.newMaxHits[maxIndex] : null;
  const maxPrev = maxHit
    ? (data.weightRecords.find((r) => r.exerciseName === maxHit.exerciseName)?.previousKg ?? null)
    : null;
  const maxDateLabel = new Date(data.endedAtMs).toLocaleDateString("pl-PL");
  const [progressDeltaUnit, setProgressDeltaUnit] = useState<ProgressDeltaUnit>("percent");

  const [cardioEditing, setCardioEditing] = useState(false);
  const [cardioStatus, setCardioStatus] = useState<"idle" | "saving" | "error" | "not-found">(
    "idle",
  );
  const [cardioMinutes, setCardioMinutes] = useState(data.cardioMinutes);
  const [cardioExtras, setCardioExtras] = useState(data.cardioExtras);
  const [draftMinutes, setDraftMinutes] = useState(
    data.cardioMinutes > 0 ? data.cardioMinutes : 20,
  );
  const [draftDistance, setDraftDistance] = useState(numOrEmpty(data.cardioExtras.distanceKm));
  const [draftHr, setDraftHr] = useState(numOrEmpty(data.cardioExtras.avgHr));
  const [draftCalories, setDraftCalories] = useState(numOrEmpty(data.cardioExtras.calories));
  const [draftSteps, setDraftSteps] = useState(numOrEmpty(data.cardioExtras.steps));

  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setMounted(true);
    setProgressDeltaUnit(readProgressDeltaUnitLocal("percent"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setRevealed(true), reduced ? 0 : 1000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    h1Ref.current?.focus({ preventScroll: true });
  }, [mounted]);

  useEffect(() => {
    if (!cardioEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setCardioEditing(false);
      setCardioStatus("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardioEditing]);

  const endedLabel = useMemo(() => {
    try {
      return new Date(data.endedAtMs)
        .toLocaleString("pl-PL", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(/\./g, "");
    } catch {
      return "";
    }
  }, [data.endedAtMs]);

  const compare = data.planCompare;
  const volumeAbs =
    compare?.previousVolumeKg != null ? data.volumeKg - compare.previousVolumeKg : null;
  const hasRealComparison =
    data.saveStatus === "saved" &&
    data.volumeKg > 0 &&
    !!compare &&
    compare.previousVolumeKg != null &&
    compare.previousVolumeKg > 0;
  /** BL-2 (005, przegląd ux 21.2): trening bez tonażu (serie na masę ciała) nigdy
   * nie ma sensownej delty objętości, choćby `compare` istniał. */
  const noTonnageComparison = data.volumeKg === 0 && data.setsDone > 0;

  const showBestSets = data.exercises.length > 0;
  const bestSetsSectionIndex = 1;
  const progressSectionVisible =
    data.saveStatus === "saved" &&
    !!compare &&
    compare.previousVolumeKg != null &&
    compare.previousVolumeKg > 0 &&
    compare.exercises.length > 0;

  function cardioSummaryLine(): string {
    const bits = [
      `${formatCountPl(cardioMinutes)} min`,
      cardioExtras.distanceKm != null ? `${formatDistanceKmPl(cardioExtras.distanceKm)} km` : null,
      cardioExtras.calories != null ? `${formatCountPl(cardioExtras.calories)} kcal` : null,
      cardioExtras.steps != null ? `${formatCountPl(cardioExtras.steps)} kroków` : null,
    ].filter(Boolean);
    return `Cardio: ${bits.join(" · ")}`;
  }

  /**
   * Przepisuje szkice z aktualnego stanu cardio (005, defekt D-03). Musi się wykonać
   * przy KAŻDYM otwarciu edytora, nie tylko przy montowaniu komponentu — inaczej
   * po zapisaniu 0 min (czyszczenie cardio) i ponownym otwarciu wracają stare,
   * usunięte wartości (dystans, tętno, kalorie, kroki), a zapis samych minut
   * przywraca dane, które użytkownik usunął.
   */
  function openCardioEditor() {
    setDraftMinutes(cardioMinutes > 0 ? cardioMinutes : 20);
    setDraftDistance(numOrEmpty(cardioExtras.distanceKm));
    setDraftHr(numOrEmpty(cardioExtras.avgHr));
    setDraftCalories(numOrEmpty(cardioExtras.calories));
    setDraftSteps(numOrEmpty(cardioExtras.steps));
    setCardioEditing(true);
  }

  async function saveCardio() {
    if (!data.workoutId) return;
    const dist = Number(String(draftDistance).replace(",", "."));
    const hr = Number(draftHr);
    const cal = Number(draftCalories);
    const steps = Number(draftSteps);
    const minutes = Math.max(0, Math.round(draftMinutes));
    const cardio: CardioPatchInput | null =
      minutes > 0
        ? {
            distanceKm: Number.isFinite(dist) && dist > 0 ? dist : null,
            avgHr: Number.isFinite(hr) && hr > 0 ? Math.round(hr) : null,
            calories: Number.isFinite(cal) && cal > 0 ? Math.round(cal) : null,
            steps: Number.isFinite(steps) && steps > 0 ? Math.round(steps) : null,
            // Nie wysyłamy starego tempa z klienta (005, D-04): serwer przelicza je
            // sam z minut i aktualnego dystansu (`patchCardioInCompletedSessionJson`).
            paceMinPerKm: null,
          }
        : null;

    setCardioStatus("saving");
    const result = await patchWorkoutCardio(data.workoutId, { cardioMinutes: minutes, cardio });
    if (result.status === "not-found") {
      setCardioStatus("not-found");
      return;
    }
    if (result.status === "error") {
      setCardioStatus("error");
      return;
    }
    setCardioMinutes(result.cardioMinutes);
    setCardioExtras((prev) => ({
      ...prev,
      distanceKm: cardio?.distanceKm ?? null,
      avgHr: cardio?.avgHr ?? null,
      calories: cardio?.calories ?? null,
      steps: cardio?.steps ?? null,
    }));
    setCardioStatus("idle");
    setCardioEditing(false);
  }

  const content = (
    <section
      className="fixed inset-0 z-[1200] flex flex-col bg-[var(--gym-black)] text-white"
      aria-labelledby="workout-finished-heading"
    >
      <div
        className="gym-finish-intro pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-[var(--gym-black)]"
        aria-hidden
      >
        <FinishRing mode="done" />
        <p className="font-display text-[34px] uppercase tracking-wide text-white">
          Trening zakończony
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto w-full max-w-lg px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
          <header className="gym-finish-rise flex items-center gap-3 pt-1" style={rise(900)}>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
              <Trophy className="h-[18px] w-[18px] text-[var(--gym-gold)]" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
                {data.planLabel || "TRENING"}
              </p>
              <h1
                id="workout-finished-heading"
                ref={h1Ref}
                tabIndex={-1}
                className="mt-0.5 font-heading text-[24px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[27px]"
              >
                Trening zakończony
              </h1>
            </div>
            <div
              role="status"
              style={rise(1600)}
              className="gym-finish-rise shrink-0 text-right text-[11px] leading-snug text-[var(--gym-text-secondary)]"
            >
              {endedLabel ? <p>{endedLabel}</p> : null}
              {data.saveStatus === "saved" ? (
                <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-[var(--gym-trend-up)]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  zapisany
                </p>
              ) : (
                <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-[var(--gym-gold)]">
                  <CloudOff className="h-3.5 w-3.5" aria-hidden />
                  offline — wyślemy później
                </p>
              )}
            </div>
          </header>

          <div
            className="app-card gym-finish-rise relative mt-4 overflow-hidden p-4"
            style={rise(1050)}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(480px_220px_at_50%_0%,rgba(var(--neon-rgb),0.12),transparent_60%)]"
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
                    Tonaż
                  </p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <AnimatedMetric
                      value={revealed ? data.volumeKg : 0}
                      decimals={Math.round(data.volumeKg * 10) % 10 === 0 ? 0 : 1}
                      durationMs={1200}
                      className="text-[2.9rem] leading-none text-white"
                    />
                    <span className="sr-only">{formatVolumeKg(data.volumeKg)}</span>
                    <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                      kg
                    </span>
                  </p>
                </div>
                <div className="shrink-0 pb-1 text-right">
                  {hasRealComparison ? (
                    <DeltaChip
                      percent={compare!.volumeDeltaPercent}
                      absolute={volumeAbs}
                      unit={progressDeltaUnit}
                      ariaLabelPrefix="Tonaż vs ostatnio"
                    />
                  ) : (
                    <span className="text-sm text-[var(--gym-text-secondary)]">—</span>
                  )}
                  <p className="mt-1 max-w-[9.5rem] text-[11px] leading-snug text-[var(--gym-text-secondary)]">
                    {hasRealComparison ? "vs ostatnio · " : ""}
                    {volumeCaption(data, compare)}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2">
                <div className="gym-finish-rise rounded-xl bg-white/[0.04] px-3 py-2" style={rise(1500)}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-text-secondary)]">
                    Czas
                  </p>
                  <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-white">
                    {formatWorkoutDurationPl(data.durationSeconds)}
                  </p>
                </div>
                <div className="gym-finish-rise rounded-xl bg-white/[0.04] px-3 py-2" style={rise(1620)}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-text-secondary)]">
                    Serie
                  </p>
                  <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-white">
                    <span aria-hidden="true">
                      {data.setsDone}
                      {data.setsTotal > 0 && data.setsTotal !== data.setsDone
                        ? `/${data.setsTotal}`
                        : null}
                    </span>
                    {data.setsTotal > 0 ? (
                      <span className="sr-only">
                        {`${data.setsDone} z ${data.setsTotal} serii wykonanych`}
                      </span>
                    ) : (
                      <span className="sr-only">{`${data.setsDone} serii wykonanych`}</span>
                    )}
                  </p>
                </div>
                <div className="gym-finish-rise rounded-xl bg-white/[0.04] px-3 py-2" style={rise(1740)}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-text-secondary)]">
                    Ćwiczenia
                  </p>
                  <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-white">
                    {data.exercises.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {data.weightRecords.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {data.weightRecords.map((row, i) => (
                <li
                  key={row.exerciseId}
                  style={rise(1900 + i * 130)}
                  className="gym-finish-rise flex items-center gap-3 rounded-2xl border border-[var(--gym-gold)]/50 bg-gradient-to-br from-[var(--gym-gold)]/20 to-[var(--gym-gold)]/[0.04] px-3.5 py-3"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gym-gold)]/20">
                    <Trophy className="h-[18px] w-[18px] text-[var(--gym-gold-bright)]" strokeWidth={1.6} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
                      Nowy rekord
                    </p>
                    <p className="mt-0.5 text-[15px] font-semibold leading-snug text-white line-clamp-2">
                      {displayExerciseName(row.exerciseName)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[15px] font-semibold leading-none tabular-nums text-[var(--gym-gold-bright)]">
                    {formatWeightRecordLine(row.previousKg, row.newKg)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          {showBestSets ? (
            <section
              className="gym-finish-rise mt-5 space-y-2"
              style={rise(2400 + Math.min(data.weightRecords.length, 3) * 130)}
            >
              <SectionLabel
                className="items-center"
                index={bestSetsSectionIndex}
                title="Najlepsze serie"
                trailing={String(data.exercises.length)}
              />
              {data.setsDone === 0 ? (
                <p className="px-0.5 text-[13px] text-[var(--gym-text-secondary)]">
                  Brak zaliczonych serii.
                </p>
              ) : null}
              <ul className="app-card divide-y divide-white/[0.06] overflow-hidden">
                {data.exercises.map((ex) => {
                  const bestIndex = bestSetIndexInExercise(ex.sets, estimated1RM);
                  const bestSet = bestIndex != null ? ex.sets[bestIndex] : null;
                  return (
                    <li key={ex.id} className="px-4 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 text-[14px] font-semibold leading-snug text-white/90 line-clamp-2">
                          {displayExerciseName(ex.name)}
                        </p>
                        {bestSet ? (
                          <p className="shrink-0 text-right text-[14px] font-semibold leading-none text-[var(--gym-gold)]">
                            <BestSetStat weight={bestSet.weight} reps={bestSet.reps ?? 0} />
                          </p>
                        ) : (
                          <p className="shrink-0 text-right text-[13px] text-[var(--gym-text-secondary)]">
                            bez zaliczonej serii
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {progressSectionVisible ? (
            <section className="gym-finish-rise mt-6" style={rise(2800)}>
              <Button
                type="button"
                variant="outline"
                aria-expanded={progressOpen}
                aria-controls="workout-finish-progress-panel"
                onClick={() => setProgressOpen((v) => !v)}
                className="h-12 w-full justify-between border-[var(--gym-border-gold)] text-[15px] font-semibold text-white/90"
              >
                {progressOpen ? "Zwiń postęp" : "Zobacz postęp"}
                {progressOpen ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )}
              </Button>

              <div
                id="workout-finish-progress-panel"
                hidden={!progressOpen}
                className={cn("app-card mt-2.5 p-4", !progressOpen && "hidden")}
              >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
                    Ten sam plan
                  </p>
                  <h2 className="mt-1 font-heading text-[18px] font-semibold leading-tight text-white">
                    Postęp vs ostatnio
                  </h2>
                  <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">
                    {compare!.planLabel?.trim() || data.title}
                    {compare!.previousDate
                      ? ` · ${formatHistoryShortDate(compare!.previousDate)} → dziś`
                      : ""}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <div className="app-card p-3.5 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                        Tonaż
                      </p>
                      <p className="mt-2 font-metric text-[24px] leading-none tabular-nums text-[var(--gym-gold)]">
                        {formatVolumeKg(compare!.currentVolumeKg)} kg
                      </p>
                      <p className="mt-1.5 text-[11px] text-[var(--gym-text-secondary)]">
                        wcześniej {formatVolumeKg(compare!.previousVolumeKg ?? 0)} kg
                      </p>
                    </div>
                    <div className="app-card p-3.5 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                        Zmiana objętości
                      </p>
                      <div className="mt-2 flex justify-center">
                        {noTonnageComparison ? (
                          <span className="text-sm text-[var(--gym-text-secondary)]">—</span>
                        ) : (
                          <DeltaChip
                            percent={compare!.volumeDeltaPercent}
                            absolute={volumeAbs}
                            unit={progressDeltaUnit}
                            ariaLabelPrefix="Zmiana objętości"
                          />
                        )}
                      </div>
                      {compare!.compare ? (
                        <p className="mt-1.5 text-[11px] leading-snug text-[var(--gym-text-secondary)]">
                          {compare!.compare.up} w górę · {compare!.compare.down} w dół ·{" "}
                          {compare!.compare.skipped} bez porównania
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {compare!.exercises.map((ex) => {
                      const absDelta =
                        ex.previousVolumeKg != null ? ex.currentVolumeKg - ex.previousVolumeKg : null;
                      const label = formatProgressDeltaPl({
                        unit: progressDeltaUnit,
                        percent: ex.deltaPercent,
                        absolute: absDelta,
                      });
                      return (
                        <li key={ex.name} className="app-card px-3.5 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold text-white">
                                {displayExerciseName(ex.name)}
                              </p>
                              <p className="mt-1 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                                {Math.round(ex.currentVolumeKg)} kg
                                {ex.previousVolumeKg != null
                                  ? ` · wcześniej ${Math.round(ex.previousVolumeKg)} kg`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 pt-0.5 text-xs font-semibold tabular-nums">
                              {ex.status === "new" ? (
                                <span className="rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--gym-gold)]">
                                  nowe
                                </span>
                              ) : ex.currentVolumeKg === 0 && ex.status !== "skipped" ? (
                                // N-22-1 (005): ćwiczenie na masę ciała (zaliczone, tonaż 0) —
                                // delta vs poprzednio z obciążeniem jest zawsze „−100%” i myląca,
                                // ten sam wzorzec jak w karcie „Zmiana objętości” wyżej.
                                <span className="text-[var(--gym-text-secondary)]">
                                  —
                                  <span className="sr-only"> brak porównania</span>
                                </span>
                              ) : ex.status === "up" ? (
                                <span className={toneClass("up")}>
                                  <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                                  {label}
                                </span>
                              ) : ex.status === "down" ? (
                                <span className={toneClass("down")}>
                                  <ArrowDownRight className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                                  {label}
                                </span>
                              ) : ex.status === "skipped" ? (
                                <span className="rounded-full border border-[var(--gym-border-gold)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--gym-text-secondary)]">
                                  bez porównania
                                </span>
                              ) : (
                                <span className={toneClass("flat")}>
                                  <Minus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                                  {label ?? "0"}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
              </div>
            </section>
          ) : null}

          <section className="gym-finish-rise mt-6" style={rise(2900)}>
            {data.workoutId == null ? (
              <div className="min-h-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-[13px] text-[var(--gym-text-secondary)]">
                  Cardio będzie dostępne po wysłaniu treningu.
                </p>
              </div>
            ) : cardioEditing ? (
              <div className="app-card px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                  Cardio
                </p>
                <p
                  id="workout-finish-cardio-minutes-label"
                  className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-text-secondary)]"
                >
                  Minuty cardio
                </p>
                <div
                  className="mt-2 flex items-center justify-center gap-4"
                  role="group"
                  aria-labelledby="workout-finish-cardio-minutes-label"
                >
                  <button
                    type="button"
                    aria-label="Mniej minut"
                    onClick={() => setDraftMinutes((m) => Math.max(0, m - 5))}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--gym-border-gold)] text-lg text-white"
                  >
                    −
                  </button>
                  <p className="min-w-[5rem] text-center font-metric text-[28px] tabular-nums text-[var(--gym-gold)]">
                    {draftMinutes}
                    <span className="ml-1 text-sm text-[var(--gym-text-secondary)]">min</span>
                  </p>
                  <button
                    type="button"
                    aria-label="Więcej minut"
                    onClick={() => setDraftMinutes((m) => Math.min(180, m + 5))}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--gym-border-gold)] text-lg text-white"
                  >
                    +
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-text-secondary)]">
                    Dystans (km)
                    <input
                      value={draftDistance}
                      onChange={(e) => setDraftDistance(e.target.value)}
                      inputMode="decimal"
                      placeholder="opcjonalnie"
                      className="mt-1 h-12 w-full rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)]/60 px-2 text-sm text-white"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-text-secondary)]">
                    Śr. tętno (bpm)
                    <input
                      value={draftHr}
                      onChange={(e) => setDraftHr(e.target.value)}
                      inputMode="numeric"
                      placeholder="opcjonalnie"
                      className="mt-1 h-12 w-full rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)]/60 px-2 text-sm text-white"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-text-secondary)]">
                    Kalorie (kcal)
                    <input
                      value={draftCalories}
                      onChange={(e) => setDraftCalories(e.target.value)}
                      inputMode="numeric"
                      placeholder="opcjonalnie"
                      className="mt-1 h-12 w-full rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)]/60 px-2 text-sm text-white"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-text-secondary)]">
                    Kroki
                    <input
                      value={draftSteps}
                      onChange={(e) => setDraftSteps(e.target.value)}
                      inputMode="numeric"
                      placeholder="opcjonalnie"
                      className="mt-1 h-12 w-full rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)]/60 px-2 text-sm text-white"
                    />
                  </label>
                </div>
                <p className="mt-3 text-[13px] text-[var(--gym-text-secondary)]">
                  0 min usuwa całe cardio, także tętno, kalorie i kroki.
                </p>
                {cardioStatus === "error" ? (
                  <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] text-white/85">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--destructive)]" aria-hidden />
                    Nie udało się zapisać cardio. Spróbuj ponownie.
                  </p>
                ) : null}
                {cardioStatus === "not-found" ? (
                  <p role="alert" className="mt-2 text-[13px] text-white/85">
                    Nie znaleziono tego treningu. Cardio nie zostało zapisane.
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={cardioStatus === "saving"}
                    onClick={() => {
                      setCardioEditing(false);
                      setCardioStatus("idle");
                    }}
                    className="h-12 border-[var(--gym-border-gold)] text-white/80"
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="button"
                    variant={draftMinutes === 0 && cardioMinutes > 0 ? "outline" : "cta"}
                    disabled={cardioStatus === "saving" || cardioStatus === "not-found"}
                    aria-busy={cardioStatus === "saving"}
                    onClick={() => void saveCardio()}
                    className={cn(
                      "h-12",
                      draftMinutes === 0 && cardioMinutes > 0
                        ? "border-[var(--destructive)]/55 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                        : null,
                    )}
                  >
                    {cardioStatus === "saving" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Zapisuję cardio…
                      </>
                    ) : draftMinutes === 0 && cardioMinutes > 0 ? (
                      "Usuń cardio"
                    ) : (
                      "Zapisz cardio"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                aria-expanded={false}
                onClick={openCardioEditor}
                className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left"
              >
                <Flame className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
                <span className="min-w-0 flex-1 text-[15px] text-white/90">
                  {cardioMinutes > 0 ? cardioSummaryLine() : "Dodaj cardio po treningu"}
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-[var(--gym-gold)]">
                  Edytuj
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--gym-text-secondary)]" aria-hidden />
              </button>
            )}
          </section>
        </div>
      </div>

      <div
        className="gym-finish-rise shrink-0 border-t border-white/[0.06] bg-[var(--gym-black)]/98 backdrop-blur-md"
        style={rise(1300)}
      >
        <div className="mx-auto w-full max-w-lg px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-5">
          <Button
            type="button"
            variant="cta"
            className="h-14 w-full"
            onClick={() => (data.newMaxHits.length > 0 ? setMaxIndex(0) : onClose())}
          >
            Zamknij
          </Button>
        </div>
      </div>

      {maxHit ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nowy rekord"
          className="absolute inset-0 z-20 flex flex-col items-center bg-[var(--gym-black)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center [background-image:radial-gradient(ellipse_at_50%_30%,rgba(var(--neon-rgb),0.3),transparent_60%)]"
        >
          <div className="flex w-full max-w-lg items-center justify-between text-[12px] text-[var(--gym-text-secondary)]">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--gym-gold)]">
              GymBrat
            </span>
            <span>{`Rekord ${(maxIndex ?? 0) + 1} z ${data.newMaxHits.length}`}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <span className="inline-flex h-28 w-28 items-center justify-center rounded-full border border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/10 shadow-[0_0_70px_rgba(var(--neon-rgb),0.35)]">
              <Trophy className="h-14 w-14 text-[var(--gym-gold-bright)]" strokeWidth={1.3} aria-hidden />
            </span>
            <p className="mt-8 text-base font-bold uppercase tracking-[0.3em] text-[var(--gym-gold)]">
              Nowy max
            </p>
            <p
              className="mt-2 font-display leading-none text-white"
              style={{ textShadow: "0 0 40px rgba(var(--neon-rgb),0.45)" }}
            >
              <span className="text-[6.5rem]">{formatKgPl(maxHit.value)}</span>
              <span className="ml-1.5 text-[2.75rem]">KG</span>
            </p>
            <p className="mt-4 max-w-[90%] text-[17px] font-bold uppercase tracking-[0.1em] text-[var(--gym-gold-bright)]">
              {displayExerciseName(maxHit.exerciseName)}
            </p>
            {maxPrev != null && maxPrev > 0 && maxHit.value > maxPrev ? (
              <p className="mt-4 rounded-full border border-[var(--gym-trend-up)]/40 bg-[var(--gym-trend-up)]/10 px-3.5 py-1.5 text-sm font-bold text-[var(--gym-trend-up)]">
                {`+${formatKgPl(maxHit.value - maxPrev)} kg · poprzednio ${formatKgPl(maxPrev)} kg`}
              </p>
            ) : null}
            <p className="mt-3 text-[13px] text-[var(--gym-text-secondary)]">{maxDateLabel}</p>
          </div>

          <div className="mb-4 flex gap-1.5" aria-hidden>
            {data.newMaxHits.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full",
                  i === maxIndex ? "w-5 bg-[var(--gym-gold)]" : "w-1.5 bg-white/25",
                )}
              />
            ))}
          </div>
          <div className="w-full max-w-lg">
            <Button
              type="button"
              variant="cta"
              className="h-14 w-full"
              onClick={() =>
                (maxIndex ?? 0) + 1 < data.newMaxHits.length
                  ? setMaxIndex((maxIndex ?? 0) + 1)
                  : onClose()
              }
            >
              {(maxIndex ?? 0) + 1 < data.newMaxHits.length ? "Dalej" : "Super!"}
            </Button>
            {(maxIndex ?? 0) + 1 < data.newMaxHits.length ? (
              <button
                type="button"
                onClick={onClose}
                className="mt-1.5 h-11 w-full text-sm text-[var(--gym-text-secondary)]"
              >
                Pomiń
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

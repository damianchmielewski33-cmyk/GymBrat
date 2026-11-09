"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Dumbbell, Flame, Medal, Scale, Trophy } from "lucide-react";
import { ExerciseGoalsEditor } from "@/components/progress/exercise-goals-editor";
import { HelpHint } from "@/components/progress/help-hint";
import { MeterRow, Sparkline, toneClass, type Tone } from "@/components/progress/progress-charts";
import { Meter } from "@/components/progress/progress-ui";
import type { AchievementIcon } from "@/lib/achievements";
import type { FatigueSnapshot } from "@/lib/analytics";
import { fmtNum, fmtPct, formatDayMonth, plural } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
import {
  FATIGUE_BAND_ADVICE,
  FATIGUE_BAND_HEADLINE,
  FATIGUE_BAND_STEPS,
  READINESS_ADVICE,
  READINESS_HEADLINE,
  type ReadinessBand,
} from "@/lib/progress-plain";
import { exerciseProgressKey, type ProgressTabId } from "@/lib/progress-tabs";
import {
  FATIGUE_COMPONENT_LABEL,
  fatigueComponentWhy,
  fatigueMissingNote,
} from "@/lib/progress-view";
import { addCalendarDays } from "@/lib/local-date";
import { cn } from "@/lib/utils";

type Period = "7" | "30" | "90";

const PERIODS: ReadonlyArray<{ id: Period; label: string }> = [
  { id: "7", label: "Ostatnie 7 dni" },
  { id: "30", label: "Ostatnie 30 dni" },
  { id: "90", label: "Ostatnie 90 dni" },
];

function Card({ children, className, hero }: { children: React.ReactNode; className?: string; hero?: boolean }) {
  return (
    <section
      className={cn(
        hero
          ? "relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] px-4 py-4"
          : "app-panel px-4 py-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
      {children}
    </h2>
  );
}

function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div role="group" aria-label="Okres" className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={p.id === value}
          onClick={() => onChange(p.id)}
          className={cn(
            "min-h-11 rounded-lg px-1 text-[12px] leading-tight font-semibold transition active:scale-[0.97]",
            p.id === value
              ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold-bright)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]"
              : "text-[var(--gym-text-secondary)]",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function AchievementGlyph({ icon }: { icon: AchievementIcon }) {
  const cls = "h-4 w-4 text-[var(--gym-gold)]";
  if (icon === "flame") return <Flame className={cls} aria-hidden />;
  if (icon === "dumbbell") return <Dumbbell className={cls} aria-hidden />;
  if (icon === "scale") return <Scale className={cls} aria-hidden />;
  if (icon === "ribbon") return <Medal className={cls} aria-hidden />;
  return <Trophy className={cls} aria-hidden />;
}

/** Cztery stopnie zmęczenia słowami, aktywny wyróżniony (bez tarczy i liczb 0–100). */
function BandScale({ band }: { band: FatigueSnapshot["band"] }) {
  const tone: Record<FatigueSnapshot["band"], string> = {
    fresh: "var(--gym-success)",
    normal: "var(--gym-gold-bright)",
    fatigued: "var(--gym-skipped)",
    overreached: "var(--gym-trend-down)",
  };
  return (
    <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Stopnie zmęczenia">
      {FATIGUE_BAND_STEPS.map((s) => {
        const on = s.id === band;
        return (
          <li key={s.id} aria-current={on ? "true" : undefined} className="flex flex-col gap-1.5">
            <span className="h-2 rounded-full" style={{ background: on ? tone[s.id] : "var(--gym-track)" }} />
            <span className={cn("text-[11px] leading-tight", on ? "font-semibold text-white" : "text-[var(--gym-text-secondary)]")}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FatigueCard({ fatigue, recovery }: { fatigue: FatigueSnapshot; recovery: ProgressHubData["intelligence"]["recovery"] }) {
  const missing = fatigueMissingNote(fatigue.missingInputs);
  const readyBand = recovery.band as ReadinessBand;
  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <CardTitle id="h-zmeczenie">Jak duże jest zmęczenie?</CardTitle>
          <HelpHint term="fatigue" />
        </div>
        <p className="font-heading mt-2 text-[24px] font-semibold leading-8 text-[var(--gym-gold-bright)]">
          {FATIGUE_BAND_HEADLINE[fatigue.band]}
        </p>
        <BandScale band={fatigue.band} />
        <p className="mt-3 text-[14px] leading-[21px] text-[#d9d2c4]">{FATIGUE_BAND_ADVICE[fatigue.band]}</p>
        {missing ? (
          <p role="note" className="mt-3 rounded-xl border border-[var(--gym-skipped)]/40 bg-[var(--gym-skipped)]/[0.08] px-3 py-2.5 text-[13px] leading-snug text-[#ffb877]">
            {missing}
          </p>
        ) : null}
        <details className="mt-3 border-t border-white/[0.07] pt-1">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between text-[14px] font-semibold text-[var(--gym-gold-bright)]">
            Z czego to wynika
          </summary>
          <ul className="mt-2 space-y-3.5">
            {fatigue.components.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="font-semibold text-white">{FATIGUE_COMPONENT_LABEL[c.key]}</span>
                  <span className="text-[13px] text-[var(--gym-text-secondary)]">
                    {fmtNum(c.points, 1)} z {c.max}
                  </span>
                </div>
                <Meter pct={c.max > 0 ? (Math.max(0, c.points) / c.max) * 100 : 0} size="lg" className="my-1.5" barClassName="gym-meter-gold" aria-label={FATIGUE_COMPONENT_LABEL[c.key]} />
                <p className="text-[13px] leading-snug text-[var(--gym-text-secondary)]">{fatigueComponentWhy(c.key, fatigue)}</p>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <CardTitle id="h-gotowosc">Gotowość na dziś</CardTitle>
          <HelpHint term="readiness" />
        </div>
        <p className="font-heading mt-2 text-[24px] font-semibold leading-8 text-[var(--gym-success)]">
          {READINESS_HEADLINE[readyBand] ?? recovery.bandLabel}
        </p>
        <p className="mt-2 text-[14px] leading-[21px] text-[#d9d2c4]">{READINESS_ADVICE[readyBand] ?? ""}</p>
        <p className="mt-2 text-[12px] leading-[18px] text-[var(--gym-text-secondary)]">
          {recovery.source === "subjective"
            ? "Na podstawie Twojej ankiety (sen, energia, stres) i obciążenia treningowego."
            : "Wypełnij ankietę dnia, a dostaniesz dokładniejszą ocenę. Na razie liczymy ją tylko z obciążenia treningowego."}
        </p>
      </Card>
    </>
  );
}

type Verdict = { title: string; sub: string };

function buildVerdict(input: {
  periodLabel: string;
  strengthPct: number | null;
  weightDelta: number | null;
  goalType: ProgressHubData["body"]["goalType"];
  regPct: number | null;
}): Verdict {
  const { strengthPct, weightDelta, goalType, regPct, periodLabel } = input;
  if (strengthPct == null && weightDelta == null && regPct == null) {
    return { title: "Za mało danych", sub: "Zapisz kilka treningów i ważeń, a tutaj pojawi się ocena." };
  }
  const parts: string[] = [];
  if (strengthPct != null) parts.push(strengthPct >= 1 ? "masz więcej siły" : strengthPct <= -3 ? "masz mniej siły" : "siła jest taka sama");
  if (weightDelta != null && Math.abs(weightDelta) >= 0.1) parts.push(weightDelta < 0 ? "waga spada" : "waga rośnie");
  else if (weightDelta != null) parts.push("waga stoi w miejscu");
  if (regPct != null) parts.push(regPct >= 70 ? "trenujesz regularnie" : regPct >= 40 ? "trenujesz mniej niż w planie" : "trenujesz dużo rzadziej niż w planie");
  const sub = `${periodLabel[0]!.toUpperCase()}${periodLabel.slice(1)}: ${parts.join(", ")}.`;
  const strengthDown = strengthPct != null && strengthPct <= -3;
  const lowReg = regPct != null && regPct < 40;
  const weightWrong =
    weightDelta != null && ((goalType === "cut" && weightDelta > 0.3) || (goalType === "bulk" && weightDelta < -0.3));
  if (strengthDown || (lowReg && !(strengthPct != null && strengthPct >= 1))) return { title: "Wymaga uwagi", sub };
  if (strengthPct != null && strengthPct >= 1 && !lowReg && !weightWrong) return { title: "Robisz postępy", sub };
  return { title: "Trzymasz kurs", sub };
}

export function SummaryTab({
  data,
  onNavigate,
}: {
  data: Pick<ProgressHubData, "intelligence" | "body" | "week">;
  onNavigate: (tab: ProgressTabId) => void;
}) {
  const { intelligence, body, week } = data;
  const [period, setPeriod] = useState<Period>("30");
  const days = Number(period);
  const today = week.summary.today;

  const strengthPct = intelligence.velocity.overall.e1rmPct[period === "7" ? "days7" : period === "30" ? "days30" : "days90"];
  const cons = period === "7" ? intelligence.consistency.week : period === "30" ? intelligence.consistency.month : intelligence.consistency.days90;
  const regPct = cons.planned > 0 ? Math.round((cons.done / cons.planned) * 100) : null;

  const weightWindow = useMemo(() => {
    const cutoff = addCalendarDays(today, -(days - 1));
    const inWin = body.weights.filter((w) => w.date >= cutoff);
    const before = body.weights.filter((w) => w.date < cutoff);
    // Punkt odniesienia: ostatni pomiar sprzed okna, a jeśli go nie ma, pierwszy z okna.
    const first = before.length ? before[before.length - 1]! : inWin[0];
    const last = body.weights[body.weights.length - 1];
    const spark = [...(before.length ? [before[before.length - 1]!] : []), ...inWin].map((w) => w.kg);
    const delta = first && last && inWin.length ? Math.round((last.kg - first.kg) * 10) / 10 : null;
    return { first, last, delta, spark };
  }, [body.weights, days, today]);

  const periodLabel = PERIODS.find((p) => p.id === period)!.label;
  const verdict = buildVerdict({
    periodLabel,
    strengthPct,
    weightDelta: weightWindow.delta,
    goalType: body.goalType,
    regPct,
  });

  const unlocked = useMemo(
    () => week.achievements.filter((a) => a.unlockedAt).sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "")),
    [week.achievements],
  );

  const attention: Array<{ key: string; title: string; sub: string; href?: string; tab?: ProgressTabId }> = [];
  for (const a of intelligence.muscle.alerts.slice(0, 2)) {
    attention.push({ key: `m-${a.higherId}-${a.lowerId}`, title: a.message, sub: `${a.lowerSets} serii wobec ${a.higherSets} w partii, którą ćwiczysz najczęściej`, tab: "sila" });
  }
  for (const s of intelligence.stagnation.filter((x) => x.status === "stagnating" || x.status === "regressing").slice(0, 3)) {
    attention.push({
      key: `s-${s.exerciseKey}`,
      title: s.status === "regressing" ? `${s.name}: masz mniej siły` : `${s.name}: siła stoi w miejscu`,
      sub: s.daysWithoutProgress > 0 ? `bez postępu od ${s.daysWithoutProgress} ${plural(s.daysWithoutProgress, "dnia", "dni", "dni")}` : s.statusLabel,
      href: `/progress/exercises/${exerciseProgressKey(s.name)}`,
    });
  }

  const emptyFirstUse = week.summary.done === 0 && intelligence.velocity.exercises.length === 0 && body.weights.length === 0;

  const strengthTone: Tone = strengthPct == null ? "flat" : strengthPct >= 1 ? "up" : strengthPct <= -3 ? "down" : "flat";
  const weightTone: Tone = "flat";

  if (emptyFirstUse) {
    return (
      <div className="space-y-3.5">
        <Card hero>
          <CardTitle id="h-start">Zacznij od pierwszego treningu</CardTitle>
          <p className="mt-3 text-[15px] leading-snug text-white">
            Tu zobaczysz, czy robisz postępy: siłę, wagę i to, jak często trenujesz. Wystarczy zapisać pierwszy trening i pierwsze ważenie.
          </p>
          <Link href="/active-workout" className="gold-btn mt-4 flex min-h-12 items-center justify-center rounded-xl px-4 text-[15px] font-semibold">
            Zacznij trening
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <Card hero>
        <PeriodSwitch value={period} onChange={setPeriod} />
        <p className="mt-4 text-[13px] font-semibold text-[var(--gym-gold)]">Jak Ci idzie?</p>
        <h2 className="font-heading mt-1 text-[28px] font-bold leading-8 text-white">{verdict.title}</h2>
        <p className="mb-2 mt-1 text-[14px] leading-snug text-[var(--gym-text-secondary)]">{verdict.sub}</p>

        <button type="button" onClick={() => onNavigate("sila")} className="pv-rise flex min-h-16 w-full items-center gap-3 border-t border-white/[0.07] py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-[var(--gym-text-secondary)]">Siła</span>
            <span className="block text-[13px] text-[var(--gym-text-secondary)]">w ćwiczeniach podnosisz więcej lub mniej niż wcześniej</span>
          </span>
          <span className={cn("font-metric min-w-[84px] text-right text-[36px] leading-none", toneClass(strengthTone))}>
            {strengthPct == null ? "—" : fmtPct(strengthPct)}
          </span>
        </button>
        <button type="button" onClick={() => onNavigate("cialo")} className="pv-rise flex min-h-16 w-full items-center gap-3 border-t border-white/[0.07] py-3 text-left" style={{ animationDelay: ".08s" }}>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-[var(--gym-text-secondary)]">Waga</span>
            <span className="block text-[13px] text-[var(--gym-text-secondary)]">
              {weightWindow.first && weightWindow.last && weightWindow.delta != null
                ? `z ${fmtNum(weightWindow.first.kg, 1)} kg na ${fmtNum(weightWindow.last.kg, 1)} kg`
                : "za mało ważeń w tym okresie"}
            </span>
          </span>
          <Sparkline values={weightWindow.spark} />
          <span className={cn("font-metric min-w-[84px] text-right text-[36px] leading-none", toneClass(weightTone))}>
            {weightWindow.delta == null ? "—" : `${weightWindow.delta > 0 ? "+" : weightWindow.delta < 0 ? "−" : ""}${fmtNum(Math.abs(weightWindow.delta), 1)} kg`}
          </span>
        </button>
        <button type="button" onClick={() => onNavigate("regularnosc")} className="pv-rise block min-h-16 w-full border-t border-white/[0.07] py-3 text-left" style={{ animationDelay: ".16s" }}>
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[13px] text-[var(--gym-text-secondary)]">Treningi</span>
              <span className="block text-[13px] text-[var(--gym-text-secondary)]">
                {cons.planned > 0 ? `Wykonane ${cons.done} z ${cons.planned} zaplanowanych` : "brak planu treningów w tym okresie"}
              </span>
            </span>
            <span className="font-metric text-[36px] leading-none text-[var(--gym-gold-bright)]">{regPct == null ? "—" : `${regPct}%`}</span>
          </span>
          <Meter pct={regPct ?? 0} size="lg" className="mt-2.5" barClassName="gym-meter-gold" aria-label="Regularność" />
        </button>
        <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">
          Siłę porównujemy z poprzednim, takim samym okresem. Wagę z ostatnim ważeniem sprzed tego okresu.
        </p>
      </Card>

      <FatigueCard fatigue={intelligence.fatigue} recovery={intelligence.recovery} />

      <Card>
        <CardTitle id="h-uwaga">Na co zwrócić uwagę</CardTitle>
        {attention.length === 0 ? (
          <p className="mt-2 text-[14px] leading-snug text-[var(--gym-text-secondary)]">
            Wszystko w porządku: żadne ćwiczenie nie stoi w miejscu, a partie ciała są ćwiczone równo.
          </p>
        ) : (
          <ul className="mt-1">
            {attention.map((a) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-white">{a.title}</span>
                    <span className="block text-[13px] text-[var(--gym-text-secondary)]">{a.sub}</span>
                  </span>
                  <span className="text-[var(--gym-skipped)]" aria-hidden>→</span>
                </>
              );
              const cls = "flex min-h-14 w-full items-center gap-3 border-b border-white/[0.06] py-2.5 text-left last:border-b-0";
              return (
                <li key={a.key}>
                  {a.href ? (
                    <Link href={a.href} className={cls}>{inner}</Link>
                  ) : (
                    <button type="button" className={cls} onClick={() => onNavigate(a.tab ?? "sila")}>{inner}</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle id="h-cele">Cele</CardTitle>
        <div className="mt-3 space-y-4">
          {week.goals.length === 0 ? (
            <p className="text-[14px] leading-snug text-[var(--gym-text-secondary)]">
              Nie masz jeszcze celów. Ustaw wagę docelową w zakładce Ciało albo dodaj cel siłowy poniżej.
            </p>
          ) : (
            week.goals.map((g) => <MeterRow key={g.id} title={g.label} right={g.remainingLabel} pct={g.progressPct} />)
          )}
        </div>
        <div className="mt-4">
          <ExerciseGoalsEditor targets={week.exerciseTargets} exerciseNames={week.exerciseNameOptions} />
        </div>
      </Card>

      <Card>
        <CardTitle id="h-osiagniecia">Osiągnięcia{unlocked.length ? ` · ${unlocked.length}` : ""}</CardTitle>
        {unlocked.length > 0 ? (
          <ul className="mt-1">
            {unlocked.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)]">
                  <AchievementGlyph icon={a.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-white">{a.title}</span>
                  <span className="block text-[13px] text-[var(--gym-text-secondary)]">{a.description}</span>
                </span>
                {a.unlockedAt ? <span className="shrink-0 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">{formatDayMonth(a.unlockedAt)}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] leading-snug text-[var(--gym-text-secondary)]">
            Zapisz kilka treningów, aby odblokować pierwsze osiągnięcia.
          </p>
        )}
      </Card>
    </div>
  );
}

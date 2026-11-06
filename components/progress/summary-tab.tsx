"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Dumbbell, Flame, Medal, Scale, Trophy } from "lucide-react";
import { BRAND_GOLD } from "@/lib/brand-colors";
import { ExerciseGoalsEditor } from "@/components/progress/exercise-goals-editor";
import { Definition, MeterRow, Sparkline, toneClass, type Tone } from "@/components/progress/progress-charts";
import { Meter } from "@/components/progress/progress-ui";
import type { AchievementIcon } from "@/lib/achievements";
import type { FatigueSnapshot } from "@/lib/analytics";
import { fmtNum, fmtPct, formatDayMonth, plural } from "@/lib/progress-format";
import type { ProgressHubData } from "@/lib/progress-hub";
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
  { id: "7", label: "7 dni" },
  { id: "30", label: "30 dni" },
  { id: "90", label: "90 dni" },
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
            "min-h-11 rounded-lg text-[13px] font-semibold transition active:scale-[0.97]",
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

/** Półokrągły wskaźnik 0–100 z czterema pasmami. */
function Gauge({ score, label }: { score: number; label: string }) {
  const ang = (s: number) => ((180 - s * 1.8) * Math.PI) / 180;
  const pt = (s: number, r: number) => [110 + r * Math.cos(ang(s)), 110 - r * Math.sin(ang(s))] as const;
  const arc = (s0: number, s1: number) => {
    const a = pt(s0, 90);
    const b = pt(s1, 90);
    return `M${a[0].toFixed(1)},${a[1].toFixed(1)} A90,90 0 0 1 ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  };
  const needle = pt(Math.max(0, Math.min(100, score)), 74);
  return (
    <svg viewBox="0 0 220 130" className="mx-auto mt-2 block h-[130px] w-full max-w-[320px]" role="img" aria-label={label}>
      <path d={arc(0, 29.5)} fill="none" stroke="#3ecf72" strokeWidth={12} opacity={0.85} />
      <path d={arc(30.5, 59.5)} fill="none" stroke={BRAND_GOLD} strokeWidth={12} opacity={0.85} />
      <path d={arc(60.5, 79.5)} fill="none" stroke="#ff9f43" strokeWidth={12} opacity={0.85} />
      <path d={arc(80.5, 100)} fill="none" stroke="#ff5a5a" strokeWidth={12} opacity={0.85} />
      <line x1={110} y1={110} x2={needle[0]} y2={needle[1]} stroke="#f6e3a1" strokeWidth={3} strokeLinecap="round" />
      <circle cx={110} cy={110} r={7} fill="#f6e3a1" stroke="#b58f3e" strokeWidth={2} />
      <text x={110} y={92} textAnchor="middle" fill="#efe9dc" fontSize={38} className="font-metric">
        {Math.round(score)}
      </text>
      <text x={14} y={126} fill="#9a9182" fontSize={11}>0</text>
      <text x={206} y={126} textAnchor="end" fill="#9a9182" fontSize={11}>100</text>
    </svg>
  );
}

function FatigueCard({ fatigue, recovery }: { fatigue: FatigueSnapshot; recovery: ProgressHubData["intelligence"]["recovery"] }) {
  const sum = Math.round(fatigue.components.reduce((a, c) => a + c.points, 0));
  const missing = fatigueMissingNote(fatigue.missingInputs);
  const delta =
    fatigue.delta7d == null
      ? "Brak tygodnia odniesienia do porównania."
      : `${fatigue.delta7d > 0 ? "+" : fatigue.delta7d < 0 ? "−" : ""}${Math.abs(Math.round(fatigue.delta7d))} pkt względem tygodnia temu`;
  return (
    <Card>
      <CardTitle id="h-zmeczenie">Zmęczenie, czyli obciążenie treningowe</CardTitle>
      <Gauge score={fatigue.score} label={`Wskaźnik zmęczenia: ${Math.round(fatigue.score)} na 100, ${fatigue.bandLabel}`} />
      <div className="text-center">
        <p className="text-[17px] font-semibold text-white">{fatigue.bandLabel}</p>
        <p className="text-[13px] text-[var(--gym-text-secondary)]">{delta}</p>
      </div>
      <Definition className="mt-3">
        <b className="text-white">Zalecenie:</b> {fatigue.recommendation}
      </Definition>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-white">Z czego to wynika</h3>
        <span className="text-[13px] text-[var(--gym-text-secondary)]">razem {sum} / 100 pkt</span>
      </div>
      <ul className="mt-3 space-y-3.5">
        {fatigue.components.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-2 text-[14px]">
              <span className="font-semibold text-white">{FATIGUE_COMPONENT_LABEL[c.key]}</span>
              <span className="text-[13px] text-[var(--gym-text-secondary)]">
                <span className="text-[#efe9dc]">{fmtNum(c.points, 1)}</span> / {c.max} pkt
              </span>
            </div>
            <Meter pct={c.max > 0 ? (Math.max(0, c.points) / c.max) * 100 : 0} size="lg" className="my-1.5" barClassName="gym-meter-gold" aria-label={FATIGUE_COMPONENT_LABEL[c.key]} />
            <p className="text-[13px] leading-snug text-[var(--gym-text-secondary)]">{fatigueComponentWhy(c.key, fatigue)}</p>
          </li>
        ))}
      </ul>
      {missing ? (
        <p role="note" className="mt-3 rounded-xl border border-[var(--gym-skipped)]/40 bg-[var(--gym-skipped)]/[0.08] px-3 py-2.5 text-[13px] leading-snug text-[#ffb877]">
          {missing}
        </p>
      ) : null}
      <Definition className="mt-3">
        Punkty z siedmiu składników sumują się do 100. <b className="text-white">0–30</b> świeżość,{" "}
        <b className="text-white">31–60</b> normalne obciążenie, <b className="text-white">61–80</b> wysokie zmęczenie,{" "}
        <b className="text-white">81–100</b> przeciążenie. To miara obciążenia treningiem, nie samopoczucia.
      </Definition>

      <div className="mt-4 flex items-baseline justify-between gap-2 text-[14px]">
        <span className="font-semibold text-white">Regeneracja</span>
        <span className="text-[13px] text-[var(--gym-text-secondary)]">
          <span className="text-[#efe9dc]">{Math.round(recovery.score)}%</span> · {recovery.bandLabel}
        </span>
      </div>
      <Meter pct={recovery.score} size="lg" className="my-2" barClassName="bg-[var(--gym-success)]" aria-label="Regeneracja" />
      <p className="text-[13px] leading-snug text-[var(--gym-text-secondary)]">
        {recovery.source === "subjective"
          ? "Liczona z Twojej ankiety (sen, energia, stres) i obciążenia treningowego."
          : "Bez ankiety to po prostu „100 minus zmęczenie”, czyli ta sama informacja co wyżej. Wypełnij ankietę dnia, żeby dostać osobną ocenę."}
      </p>
    </Card>
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
    return { title: "Za mało danych", sub: "Zapisz kilka treningów i raportów wagi, a tutaj pojawi się ocena." };
  }
  const parts: string[] = [];
  if (strengthPct != null) parts.push(strengthPct >= 1 ? "siła rośnie" : strengthPct <= -3 ? "siła spada" : "siła stoi w miejscu");
  if (weightDelta != null && Math.abs(weightDelta) >= 0.1) parts.push(weightDelta < 0 ? "waga spada" : "waga rośnie");
  else if (weightDelta != null) parts.push("waga stoi");
  if (regPct != null) parts.push(regPct >= 70 ? "trenujesz regularnie" : regPct >= 40 ? "regularność średnia" : "trenujesz rzadziej niż w planie");
  const sub = `Za ostatnie ${periodLabel}: ${parts.join(", ")}.`;
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
    attention.push({ key: `m-${a.higherId}-${a.lowerId}`, title: a.message, sub: `${a.lowerSets} serii wobec ${a.higherSets} w mocniejszej partii`, tab: "sila" });
  }
  for (const s of intelligence.stagnation.filter((x) => x.status === "stagnating" || x.status === "regressing").slice(0, 3)) {
    attention.push({
      key: `s-${s.exerciseKey}`,
      title: s.status === "regressing" ? `${s.name} traci siłę` : `${s.name} stoi w miejscu`,
      sub: s.daysWithoutProgress > 0 ? `bez wzrostu od ${s.daysWithoutProgress} ${plural(s.daysWithoutProgress, "dnia", "dni", "dni")}` : s.statusLabel,
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
            Tu zobaczysz, czy robisz postępy: siłę, wagę i regularność w jednym miejscu. Wystarczy zapisać pierwszy trening i raport wagi.
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
        <h2 className="font-metric mt-4 text-[44px] leading-none text-white">{verdict.title}</h2>
        <p className="mb-2 mt-1 text-[14px] leading-snug text-[var(--gym-text-secondary)]">{verdict.sub}</p>

        <button type="button" onClick={() => onNavigate("sila")} className="pv-rise flex min-h-16 w-full items-center gap-3 border-t border-white/[0.07] py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-white">Siła</span>
            <span className="block text-[13px] text-[var(--gym-text-secondary)]">szacowany max w ćwiczeniach, średnio</span>
          </span>
          <span className={cn("font-metric min-w-[84px] text-right text-[36px] leading-none", toneClass(strengthTone))}>
            {strengthPct == null ? "—" : fmtPct(strengthPct)}
          </span>
        </button>
        <button type="button" onClick={() => onNavigate("cialo")} className="pv-rise flex min-h-16 w-full items-center gap-3 border-t border-white/[0.07] py-3 text-left" style={{ animationDelay: ".08s" }}>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-white">Waga</span>
            <span className="block text-[13px] text-[var(--gym-text-secondary)]">
              {weightWindow.first && weightWindow.last && weightWindow.delta != null
                ? `od ${fmtNum(weightWindow.first.kg, 1)} do ${fmtNum(weightWindow.last.kg, 1)} kg`
                : "za mało pomiarów w tym okresie"}
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
              <span className="block text-[16px] font-semibold text-white">Regularność</span>
              <span className="block text-[13px] text-[var(--gym-text-secondary)]">
                {cons.planned > 0 ? `${cons.done} z ${cons.planned} zaplanowanych treningów` : "brak planu treningów w tym okresie"}
              </span>
            </span>
            <span className="font-metric text-[36px] leading-none text-[var(--gym-gold-bright)]">{regPct == null ? "—" : `${regPct}%`}</span>
          </span>
          <Meter pct={regPct ?? 0} size="lg" className="mt-2.5" barClassName="gym-meter-gold" aria-label="Regularność" />
        </button>
        <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">
          Siłę porównujemy z poprzednim takim samym okresem, wagę z pomiarem sprzed okna.
        </p>
      </Card>

      <FatigueCard fatigue={intelligence.fatigue} recovery={intelligence.recovery} />

      <Card>
        <CardTitle id="h-uwaga">Na co uważać</CardTitle>
        {attention.length === 0 ? (
          <p className="mt-2 text-[14px] leading-snug text-[var(--gym-text-secondary)]">
            Nic niepokojącego: żadne ćwiczenie nie stoi w miejscu, a partie mięśni są w równowadze.
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

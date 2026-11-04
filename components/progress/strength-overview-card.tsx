"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { getStrengthOverviewAction } from "@/actions/progress-metrics";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import {
  CollapsibleCard,
  EmptyNote,
  Explainer,
  ProgressSection,
  SegmentedControl,
  Surface,
} from "@/components/progress/progress-ui";
import { formatPeriodDeltaPct } from "@/lib/exercise-period-compare";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import {
  MAX_OVERVIEW_RANGE_DAYS,
  MIN_EXERCISES_FOR_CONFIDENT_INDEX,
  STRENGTH_FLAT_BAND_PCT,
  resolveOverviewRange,
  type OverviewPreset,
  type OverviewStatus,
  type StrengthOverview,
} from "@/lib/strength-overview";
import { cn } from "@/lib/utils";

const PRESETS: ReadonlyArray<{ id: OverviewPreset; label: string }> = [
  { id: "7", label: "7 dni" },
  { id: "30", label: "30 dni" },
  { id: "90", label: "3 mies." },
  { id: "range", label: "Własny" },
];

const STATUS_TONE: Record<OverviewStatus, string> = {
  up: "text-emerald-300",
  down: "text-[var(--gym-text-secondary)]",
  flat: "text-white/60",
  insufficient: "text-white/50",
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; overview: StrengthOverview };

function StatusIcon({ status }: { status: OverviewStatus }) {
  if (status === "up") {
    return <ArrowUpRight className="h-4 w-4 text-emerald-300" aria-hidden />;
  }
  if (status === "down") {
    return (
      <ArrowDownRight
        className="h-4 w-4 text-[var(--gym-text-secondary)]"
        aria-hidden
      />
    );
  }
  return <Minus className="h-4 w-4 text-white/50" aria-hidden />;
}

function formatDay(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function verdictStatus(v: StrengthOverview["verdict"]): OverviewStatus {
  if (v === "progress") return "up";
  if (v === "regress") return "down";
  if (v === "flat") return "flat";
  return "insufficient";
}

function CountChip({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: OverviewStatus;
}) {
  return (
    <li className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[12px] text-white/80">
      <StatusIcon status={status} />
      {label}
      <span className="tabular-nums text-[var(--gym-text-secondary)]">
        {count}
      </span>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
      <div className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>
  );
}

function OverviewResult({ overview }: { overview: StrengthOverview }) {
  const vStatus = verdictStatus(overview.verdict);
  const empty = overview.exercises.length === 0;

  if (empty) {
    return (
      <EmptyNote>
        Brak ćwiczeń z ciężarem w tym okresie ani w poprzednim. Zaloguj
        trening, a porównanie pojawi się tutaj.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Indeks siły · mediana zmian e1RM
            </p>
            <p
              className={cn(
                "mt-1 font-heading text-[28px] font-semibold leading-8 tabular-nums",
                STATUS_TONE[vStatus],
              )}
            >
              {formatPeriodDeltaPct(overview.indexDeltaPct)}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-white">
              {overview.verdictLabel}
            </p>
          </div>
          <StatusIcon status={vStatus} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/50">
          {formatDay(overview.from)} – {formatDay(overview.to)}
          <span className="mx-1.5 text-white/50">vs</span>
          {formatDay(overview.previousFrom)} – {formatDay(overview.previousTo)}
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label="Podsumowanie ćwiczeń">
        <CountChip label="Rośnie" count={overview.counts.up} status="up" />
        <CountChip label="Stabilnie" count={overview.counts.flat} status="flat" />
        <CountChip label="Spada" count={overview.counts.down} status="down" />
        <CountChip
          label="Za mało danych"
          count={overview.counts.insufficient}
          status="insufficient"
        />
      </ul>

      {overview.lowConfidence ? (
        <InlineBanner variant="info" role="status" className="text-[12px]">
          Wynik opiera się na mniej niż {MIN_EXERCISES_FOR_CONFIDENT_INDEX}{" "}
          ćwiczeniach z wystarczającą liczbą sesji — traktuj go orientacyjnie.
        </InlineBanner>
      ) : null}

      {overview.groups.length > 0 ? (
        <CollapsibleCard
          title="Grupy mięśniowe"
          summary={`${overview.groups.length}`}
          defaultOpen
        >
          <ul className="divide-y divide-white/[0.06]">
            {overview.groups.map((g) => (
              <li
                key={g.id}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white/85">
                    {g.label}
                  </p>
                  <p className="text-[11px] text-white/50">
                    {g.up} rośnie · {g.flat} stabilnie · {g.down} spada
                    {g.insufficient > 0
                      ? ` · ${g.insufficient} za mało danych`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <StatusIcon status={g.status} />
                  <span
                    className={cn(
                      "font-heading text-sm tabular-nums",
                      STATUS_TONE[g.status],
                    )}
                  >
                    {formatPeriodDeltaPct(g.medianDeltaPct)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleCard>
      ) : null}

      <CollapsibleCard title="Ćwiczenia" summary={`${overview.exercises.length}`}>
        <ul className="divide-y divide-white/[0.06]">
          {overview.exercises.map((e) => (
            <li key={e.key}>
              <Link
                href={`/progress/exercises/${exerciseProgressKey(e.name)}`}
                className="flex min-h-11 items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white/85">
                    {e.name}
                  </p>
                  <p className="text-[11px] text-white/50">
                    {e.status === "insufficient"
                      ? `Za mało sesji (poprzednio ${e.sessionsPrevious}, teraz ${e.sessionsCurrent})`
                      : `${e.previousE1rm ?? "—"} → ${e.currentE1rm ?? "—"} kg · sesje ${e.sessionsPrevious} → ${e.sessionsCurrent}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <StatusIcon status={e.status} />
                  <span
                    className={cn(
                      "font-heading text-sm tabular-nums",
                      STATUS_TONE[e.status],
                    )}
                  >
                    {e.status === "insufficient"
                      ? "—"
                      : formatPeriodDeltaPct(e.deltaPct)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CollapsibleCard>
    </div>
  );
}

export function StrengthOverviewCard() {
  const [preset, setPreset] = useState<OverviewPreset>("30");
  const [rangeTo, setRangeTo] = useState<string>(() => calendarDateKey());
  const [rangeFrom, setRangeFrom] = useState<string>(() =>
    addCalendarDays(calendarDateKey(), -29),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const requestRef = useRef(0);

  const today = calendarDateKey();
  const rangeValid =
    resolveOverviewRange("range", today, { from: rangeFrom, to: rangeTo }) !=
    null;
  const invalidRange = preset === "range" && !rangeValid;

  useEffect(() => {
    if (preset === "range" && !rangeValid) return;
    const requestId = ++requestRef.current;
    // setState w timerze/promisie (jak w ProgressHubView) — bez kaskady renderów w efekcie.
    const timer = window.setTimeout(
      () => {
        setView({ status: "loading" });
        void getStrengthOverviewAction(
          preset === "range"
            ? { preset, from: rangeFrom, to: rangeTo }
            : { preset },
        )
          .then((res) => {
            if (requestId !== requestRef.current) return;
            setView(
              res.ok
                ? { status: "ok", overview: res.overview }
                : { status: "error", message: res.error },
            );
          })
          .catch(() => {
            if (requestId !== requestRef.current) return;
            setView({
              status: "error",
              message: "Nie udało się wczytać porównania. Spróbuj ponownie.",
            });
          });
      },
      // Własny zakres: krótkie opóźnienie, żeby nie wołać serwera przy każdym znaku daty.
      preset === "range" ? 350 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [preset, rangeFrom, rangeTo, rangeValid, reloadKey]);

  return (
    <ProgressSection title="Siła w czasie" trailing="wszystkie ćwiczenia">
      <Surface className="space-y-3 p-3.5">
        <p className="text-[13px] leading-snug text-white/65">
          Czy Twoja siła średnio rośnie czy spada — po wszystkich ćwiczeniach i
          po grupach mięśniowych, względem poprzedniego okresu tej samej
          długości.
        </p>

        <SegmentedControl
          options={PRESETS}
          value={preset}
          onChange={setPreset}
          ariaLabel="Okres porównania siły"
        />

        {preset === "range" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  Od
                </span>
                <Input
                  type="date"
                  value={rangeFrom}
                  max={rangeTo || undefined}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  aria-label="Początek zakresu porównania siły"
                  aria-invalid={invalidRange}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  Do
                </span>
                <Input
                  type="date"
                  value={rangeTo}
                  min={rangeFrom || undefined}
                  max={today}
                  onChange={(e) => setRangeTo(e.target.value)}
                  aria-label="Koniec zakresu porównania siły"
                  aria-invalid={invalidRange}
                />
              </label>
            </div>
            <p
              className={cn(
                "text-[11px]",
                invalidRange ? "text-[var(--gym-gold)]" : "text-white/50",
              )}
              role={invalidRange ? "alert" : undefined}
            >
              {invalidRange
                ? `Wybierz poprawny zakres: „od” nie późniejsze niż „do”, bez przyszłości, maks. ${MAX_OVERVIEW_RANGE_DAYS} dni.`
                : "Porównanie z poprzednim okresem tej samej długości."}
            </p>
          </div>
        ) : null}

        <div aria-live="polite" aria-busy={view.status === "loading"}>
          {invalidRange ? null : view.status === "loading" ? (
            <Skeleton />
          ) : view.status === "error" ? (
            <div className="space-y-2">
              <InlineBanner variant="error" role="alert">
                {view.message}
              </InlineBanner>
              <button
                type="button"
                onClick={() => {
                  setView({ status: "loading" });
                  setReloadKey((k) => k + 1);
                }}
                className="min-h-11 rounded-xl border border-white/15 px-4 text-[13px] font-semibold text-white/85 active:scale-[0.98]"
              >
                Spróbuj ponownie
              </button>
            </div>
          ) : (
            <OverviewResult overview={view.overview} />
          )}
        </div>

        <Explainer>
          <p>
            Dla każdego ćwiczenia z dodatkowym ciężarem liczymy średnie e1RM
            (szacowany ciężar na jedno powtórzenie) z najlepszej serii roboczej
            każdej sesji i porównujemy je z poprzednim okresem. Wynik zbiorczy
            to mediana tych zmian, więc jedno nietypowe ćwiczenie go nie
            zakłóca. Ćwiczenie liczy się od 2 sesji w obu okresach, a zmiana
            poniżej {STRENGTH_FLAT_BAND_PCT}% to „stabilnie”. Ćwiczenia bez
            dodatkowego ciężaru (np. podciąganie z własną masą) nie są tu
            uwzględnione.
          </p>
        </Explainer>
      </Surface>
    </ProgressSection>
  );
}

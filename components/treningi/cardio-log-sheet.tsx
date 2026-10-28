"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Footprints, Loader2, X } from "lucide-react";
import { logCardioDetailedAction } from "@/actions/workout";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { CardioLogDetailsSection } from "@/components/treningi/cardio-log-details-section";
import { CardioLogMinutesField } from "@/components/treningi/cardio-log-minutes-field";
import { CardioLogTypePicker } from "@/components/treningi/cardio-log-type-picker";
import {
  CardioLogWeekProgress,
  type CardioWeekProgress,
} from "@/components/treningi/cardio-log-week-progress";
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekMondayKey,
} from "@/lib/local-date";
import {
  CARDIO_TYPE_LABELS_PL,
  resolveCardioType,
  validateCardioMetrics,
  type CardioFieldError,
  type CardioFieldKey,
  type CardioTypeSlug,
} from "@/lib/cardio-utils";
import { cn } from "@/lib/utils";

export type { CardioWeekProgress };

type CardioLogSheetProps = {
  open: boolean;
  onClose: () => void;
  weekProgress: CardioWeekProgress;
  defaultTitle?: string;
};

type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: CardioFieldError[];
  id?: string;
  weekMinutesAfter?: number;
  minutes?: number;
  dateKey?: string;
};

function localDateInputValue(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateLabelPl(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }).format(new Date(y!, m! - 1, d!, 12));
  } catch {
    return dateKey;
  }
}

function errorsToMap(
  list: CardioFieldError[] | undefined,
): Partial<Record<CardioFieldKey, string>> {
  const out: Partial<Record<CardioFieldKey, string>> = {};
  for (const e of list ?? []) {
    if (!out[e.field]) out[e.field] = e.message;
  }
  return out;
}

function noteFromDefaultTitle(defaultTitle: string, slug: CardioTypeSlug): string {
  const matchLabel =
    CARDIO_TYPE_LABELS_PL[slug] === defaultTitle ||
    Object.values(CARDIO_TYPE_LABELS_PL).some(
      (l) => l.toLowerCase() === String(defaultTitle).toLowerCase(),
    );
  return matchLabel ? "" : String(defaultTitle);
}

export function CardioLogSheet({
  open,
  onClose,
  weekProgress,
  defaultTitle = "Marsz",
}: CardioLogSheetProps) {
  const [wasOpen, setWasOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSessionKey((k) => k + 1);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <CardioLogSheetDialog
      key={sessionKey}
      onClose={onClose}
      weekProgress={weekProgress}
      defaultTitle={defaultTitle}
    />,
    document.body,
  );
}

function CardioLogSheetDialog({
  onClose,
  weekProgress,
  defaultTitle,
}: {
  onClose: () => void;
  weekProgress: CardioWeekProgress;
  defaultTitle: string;
}) {
  const router = useRouter();
  const { notifyError } = useSaveFeedback();
  const initialSlug = resolveCardioType(defaultTitle);

  const [machine, setMachine] = useState<CardioTypeSlug>(initialSlug);
  const [minutesText, setMinutesText] = useState("30");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [maxHr, setMaxHr] = useState("");
  const [calories, setCalories] = useState("");
  const [steps, setSteps] = useState("");
  const [effortScore, setEffortScore] = useState<number | null>(null);
  const [note, setNote] = useState(() =>
    noteFromDefaultTitle(defaultTitle, initialSlug),
  );
  const [dateKey, setDateKey] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<
    Partial<Record<CardioFieldKey, string>>
  >({});

  const handledIdRef = useRef<string | null>(null);
  const notifiedErrorRef = useRef<string | null>(null);
  const minutesInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [state, formAction, pending] = useActionState(
    logCardioDetailedAction as (
      prev: ActionState,
      formData: FormData,
    ) => Promise<ActionState>,
    {} as ActionState,
  );

  const success =
    state?.ok === true && state.id
      ? {
          id: state.id,
          minutes: state.minutes ?? (Number(minutesText) || 0),
          weekMinutesAfter:
            state.weekMinutesAfter ?? weekProgress.minutesCompleted,
          dateKey: state.dateKey ?? calendarDateKey(),
        }
      : null;

  const serverFieldErrors =
    state?.ok === false && state.fieldErrors?.length
      ? errorsToMap(state.fieldErrors)
      : null;
  const fieldErrors = { ...clientErrors, ...serverFieldErrors };

  const forceDetailsOpen =
    state?.ok === false &&
    !!state.fieldErrors?.some(
      (e) => e.field !== "minutes" && e.field !== "date",
    );
  const detailsExpanded = detailsOpen || forceDetailsOpen;

  // Tylko efekty uboczne na zewnątrz React (refresh / toast) — bez setState.
  useEffect(() => {
    if (state?.ok === true && state.id && handledIdRef.current !== state.id) {
      handledIdRef.current = state.id;
      router.refresh();
    } else if (
      state?.ok === false &&
      state.error &&
      !state.fieldErrors?.length &&
      notifiedErrorRef.current !== state.error
    ) {
      notifiedErrorRef.current = state.error;
      notifyError(state.error);
    }
  }, [state, router, notifyError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = minutesInputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (pending) return;
      e.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  const maxDate = useMemo(() => localDateInputValue(0), []);
  const minDate = useMemo(() => localDateInputValue(-60), []);
  const todayKey = calendarDateKey();
  const effectiveDate = dateKey || todayKey;
  const todayMonday = calendarWeekMondayKey(todayKey);
  const entryMonday = calendarWeekMondayKey(effectiveDate);
  const entryInThisWeek = entryMonday === todayMonday;

  const previewAfter = useMemo(() => {
    if (!entryInThisWeek) return null;
    const m = /^\d+$/.test(minutesText.trim())
      ? Number(minutesText.trim())
      : null;
    if (m == null || m < 1) return null;
    return weekProgress.minutesCompleted + m;
  }, [entryInThisWeek, minutesText, weekProgress.minutesCompleted]);

  const minutesError = fieldErrors.minutes ?? null;
  const canSubmit = !pending && !minutesError && minutesText.trim() !== "";
  const goal = weekProgress.goalMinutes;
  const dateLine = dateKey
    ? `zapisuję na ${dateLabelPl(dateKey)}`
    : `zapisuję na dziś, ${dateLabelPl(todayKey)}`;
  const minutesForCta = /^\d+$/.test(minutesText.trim())
    ? minutesText.trim()
    : null;
  const ctaDateSuffix =
    dateKey && dateKey !== todayKey
      ? ` · ${shortDateDdMm(dateKey)}`
      : "";

  function validateField(field: CardioFieldKey) {
    const result = validateCardioMetrics({
      minutes: minutesText,
      distanceKm,
      avgHr,
      maxHr,
      calories,
      steps,
      effortScore: effortScore == null ? "" : String(effortScore),
      notes: note,
      date: dateKey || undefined,
    });
    setClientErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      if (!result.ok) {
        const hit = result.fieldErrors.find((e) => e.field === field);
        if (hit) next[field] = hit.message;
      }
      return next;
    });
  }

  function validateAll(): CardioFieldError[] {
    const result = validateCardioMetrics({
      minutes: minutesText,
      distanceKm,
      avgHr,
      maxHr,
      calories,
      steps,
      effortScore: effortScore == null ? "" : String(effortScore),
      notes: note,
      date: dateKey || undefined,
    });
    if (result.ok) {
      setClientErrors({});
      return [];
    }
    setClientErrors(errorsToMap(result.fieldErrors));
    return result.fieldErrors;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const errs = validateAll();
    if (errs.length) {
      e.preventDefault();
      const first = errs[0]!;
      if (first.field !== "minutes" && first.field !== "date") {
        setDetailsOpen(true);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-[3px]"
        aria-label="Zamknij"
        disabled={pending}
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardio-sheet-title"
        className="app-dialog relative z-[1] flex h-[min(88dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] sm:h-auto sm:max-h-[88dvh] sm:rounded-[22px]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(165deg, rgba(235,196,74,0.16) 0%, transparent 58%)",
          }}
          aria-hidden
        />

        <div className="relative flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Cardio
            </p>
            <h2
              id="cardio-sheet-title"
              className="mt-1.5 text-[24px] font-semibold leading-tight tracking-tight text-white"
            >
              Dodaj cardio
            </h2>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!pending) onClose();
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <CheckCircle2
                className="h-8 w-8 text-[var(--gym-gold)]"
                aria-hidden
              />
              <h3 className="mt-3 text-[24px] font-semibold text-white">
                Zapisano {success.minutes} min
              </h3>
              <p className="mt-2 text-[15px] text-white/85">
                {success.weekMinutesAfter >= goal
                  ? `Cel tygodnia zrobiony: ${success.weekMinutesAfter} z ${goal} min.`
                  : `Tydzień: ${success.weekMinutesAfter} z ${goal} min.`}
              </p>
              <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
                Wpis trafił na {dateLabelPl(success.dateKey)}.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/cardio/${success.id}`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-12 w-full",
                )}
              >
                Zobacz wpis
              </Link>
              <Button
                type="button"
                variant="cta"
                className="h-12 w-full"
                onClick={onClose}
                autoFocus
              >
                Gotowe
              </Button>
            </div>
          </div>
        ) : (
          <form
            action={formAction}
            onSubmit={onSubmit}
            className="relative flex min-h-0 flex-1 flex-col"
          >
            <input
              type="hidden"
              name="title"
              value={CARDIO_TYPE_LABELS_PL[machine]}
            />
            <input type="hidden" name="cardioType" value={machine} />
            <input type="hidden" name="minutes" value={minutesText} />
            <input type="hidden" name="distanceKm" value={distanceKm} />
            <input type="hidden" name="avgHr" value={avgHr} />
            <input type="hidden" name="maxHr" value={maxHr} />
            <input type="hidden" name="calories" value={calories} />
            <input type="hidden" name="steps" value={steps} />
            <input
              type="hidden"
              name="effortScore"
              value={effortScore == null ? "" : String(effortScore)}
            />
            <input type="hidden" name="notes" value={note} />
            <input type="hidden" name="date" value={dateKey} />

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-3">
              <CardioLogWeekProgress
                weekProgress={weekProgress}
                previewAfter={previewAfter}
              />

              <CardioLogTypePicker
                value={machine}
                onChange={setMachine}
                disabled={pending}
              />

              <CardioLogMinutesField
                minutesText={minutesText}
                inputRef={minutesInputRef}
                onMinutesTextChange={(v) => {
                  setMinutesText(v);
                  const result = validateCardioMetrics({
                    minutes: v,
                    distanceKm,
                    avgHr,
                    maxHr,
                    calories,
                    steps,
                  });
                  setClientErrors((prev) => {
                    const next = { ...prev };
                    delete next.minutes;
                    if (!result.ok) {
                      const hit = result.fieldErrors.find(
                        (e) => e.field === "minutes",
                      );
                      if (hit) next.minutes = hit.message;
                    }
                    return next;
                  });
                }}
                error={minutesError}
                disabled={pending}
                errorId="err-minutes"
              />

              <div className="rounded-2xl border border-white/[0.08] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
                      Dzień
                    </p>
                    <p className="mt-1 text-[14px] text-white">{dateLine}</p>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-[var(--gym-gold)]"
                    onClick={() => setDateOpen((v) => !v)}
                  >
                    Zmień
                  </button>
                </div>
                {dateOpen ? (
                  <input
                    type="date"
                    value={dateKey || calendarDateKey()}
                    min={minDate}
                    max={maxDate}
                    disabled={pending}
                    aria-invalid={fieldErrors.date != null}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDateKey(v === calendarDateKey() ? "" : v);
                      setDateOpen(false);
                    }}
                    className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-[var(--gym-surface-raised)] px-3 text-sm text-white outline-none"
                  />
                ) : null}
                {fieldErrors.date ? (
                  <p className="mt-1 text-[12px] text-[#ff8593]" role="alert">
                    {fieldErrors.date}
                  </p>
                ) : null}
                {!entryInThisWeek && dateKey ? (
                  <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">
                    Wpis trafi do tygodnia {formatWeekOf(dateKey)} — nie zmienia
                    bieżącego postępu powyżej.
                  </p>
                ) : null}
              </div>

              <CardioLogDetailsSection
                open={detailsExpanded}
                onToggle={() => setDetailsOpen((v) => !v)}
                distanceKm={distanceKm}
                avgHr={avgHr}
                maxHr={maxHr}
                calories={calories}
                steps={steps}
                effortScore={effortScore}
                note={note}
                fieldErrors={fieldErrors}
                disabled={pending}
                onChange={(patch) => {
                  if (patch.distanceKm != null) setDistanceKm(patch.distanceKm);
                  if (patch.avgHr != null) setAvgHr(patch.avgHr);
                  if (patch.maxHr != null) setMaxHr(patch.maxHr);
                  if (patch.calories != null) setCalories(patch.calories);
                  if (patch.steps != null) setSteps(patch.steps);
                  if (patch.note != null) setNote(patch.note);
                  if ("effortScore" in patch)
                    setEffortScore(patch.effortScore ?? null);
                }}
                onBlurField={validateField}
              />
            </div>

            <div className="relative shrink-0 border-t border-white/[0.06] bg-[var(--gym-surface-sunken)]/95 px-5 pt-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] backdrop-blur-sm">
              <p className="mb-2 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
                Liczy się czas. Pozostałe pola to dane do analizy obciążenia.
              </p>
              {state?.ok === false &&
              state.error &&
              !state.fieldErrors?.length ? (
                <InlineBanner variant="error" role="alert" className="mb-2">
                  {state.error}
                </InlineBanner>
              ) : null}
              <button
                type="submit"
                disabled={!canSubmit}
                className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-[0_8px_28px_rgba(235,196,74,0.45)] disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Zapisuję…
                  </>
                ) : minutesError ? (
                  "Podaj minuty, by zapisać"
                ) : (
                  <>
                    <Footprints className="h-4 w-4" aria-hidden />
                    Zapisz {minutesForCta ?? "…"} min{ctaDateSuffix}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function formatWeekOf(dateKey: string): string {
  const monday = calendarWeekMondayKey(dateKey);
  const sun = addCalendarDays(monday, 6);
  const a = new Date(`${monday}T12:00:00`);
  const b = new Date(`${sun}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "numeric" });
  return `${fmt(a)}–${fmt(b)}`;
}

function shortDateDdMm(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "numeric",
    }).format(new Date(y!, m! - 1, d!, 12));
  } catch {
    return dateKey;
  }
}

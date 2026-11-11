"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import {
  applyPlanReviewAction,
  getSetCountSuggestionsAction,
  type SetCountSuggestion,
} from "@/actions/plan-review";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
  appDialogButtonClass,
} from "@/components/ui/app-dialog";

/** Po „Nie teraz” nie pytamy o tę samą propozycję przez 21 dni. */
const SNOOZE_MS = 21 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = "gymbrat:sets-suggestion:";

function snoozeKey(planId: string, s: SetCountSuggestion): string {
  return `${KEY_PREFIX}${planId}:${s.id}:${s.to}`;
}

function isSnoozed(planId: string, s: SetCountSuggestion): boolean {
  try {
    const raw = window.localStorage.getItem(snoozeKey(planId, s));
    return raw != null && Date.now() - Number(raw) < SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze(planId: string, list: SetCountSuggestion[]): void {
  try {
    for (const s of list) {
      window.localStorage.setItem(snoozeKey(planId, s), String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Pop-up po zakończonym treningu: silnik przeglądu planu zauważył, że użytkownik
 * notorycznie robi więcej (lub mniej) serii niż w planie — pyta, czy dopasować plan.
 */
export function PlanSetsSuggestion({
  planId,
  enabled,
}: {
  planId: string | null;
  /** Tylko gdy trening jest zapisany na serwerze (nie w kolejce offline). */
  enabled: boolean;
}) {
  const [items, setItems] = useState<SetCountSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId || !enabled) return;
    let cancelled = false;
    let timer: number | undefined;
    void getSetCountSuggestionsAction(planId)
      .then((list) => {
        if (cancelled) return;
        const fresh = list.filter((s) => !isSnoozed(planId, s));
        if (fresh.length === 0) return;
        setItems(fresh);
        // Najpierw ekran podsumowania, pytanie chwilę później.
        timer = window.setTimeout(() => setOpen(true), 1400);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [planId, enabled]);

  if (!planId || items.length === 0) return null;

  const allMore = items.every((i) => i.direction === "more");
  const allFewer = items.every((i) => i.direction === "fewer");
  const title = allMore
    ? "Zwiększyć liczbę serii w planie?"
    : allFewer
      ? "Zmniejszyć liczbę serii w planie?"
      : "Dopasować liczbę serii w planie?";

  async function apply() {
    if (!planId) return;
    setBusy(true);
    setError(null);
    const res = await applyPlanReviewAction({
      planId,
      kind: "review",
      summary: "Dopasowanie liczby serii do realnego treningu",
      changes: items.map((i) => ({ exerciseId: i.exerciseId, sets: i.to })),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  function later() {
    if (planId) snooze(planId, items);
    setOpen(false);
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !done) later();
        else setOpen(v);
      }}
      tone="gold"
      icon={Layers}
      title={done ? "Plan zaktualizowany" : title}
      description={
        done
          ? "Nowa liczba serii obowiązuje od kolejnego treningu. Zmianę cofniesz w Przeglądzie planu."
          : "Silnik GymBrat przeanalizował Twoje ostatnie treningi tego planu. Nic nie zmienimy bez Twojej zgody."
      }
    >
      {done ? null : (
        <ul className="mt-4 w-full space-y-2.5 text-left">
          {items.map((i) => (
            <li
              key={i.id}
              className="rounded-2xl border border-white/10 bg-black/30 px-3.5 py-3"
            >
              <p className="flex items-center justify-between gap-2 text-[14px] font-semibold text-white">
                <span className="min-w-0 truncate">{i.exerciseName}</span>
                <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-[var(--gym-gold)]">
                  {i.from} <ArrowRight className="h-3.5 w-3.5" aria-hidden /> {i.to}
                </span>
              </p>
              <p className="mt-1 text-[12px] leading-snug text-white/60">
                {i.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-rose-300">
          {error}
        </p>
      ) : null}
      <AppDialogActions>
        {done ? (
          <>
            <Link
              href="/progress/przeglad-planu"
              className={appDialogButtonClass("quiet", "inline-flex items-center justify-center")}
            >
              Przegląd planu
            </Link>
            <AppDialogButton intent="primary" onClick={() => setOpen(false)}>
              Gotowe
            </AppDialogButton>
          </>
        ) : (
          <>
            <AppDialogButton intent="primary" disabled={busy} onClick={apply}>
              {busy
                ? "Zapisywanie…"
                : allMore
                  ? "Zwiększ liczbę serii"
                  : allFewer
                    ? "Zmniejsz liczbę serii"
                    : "Zastosuj zmiany"}
            </AppDialogButton>
            <AppDialogButton disabled={busy} onClick={later}>
              Nie teraz
            </AppDialogButton>
          </>
        )}
      </AppDialogActions>
    </AppDialog>
  );
}

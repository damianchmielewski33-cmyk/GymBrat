"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyPlanReviewAction,
  revertPlanRevisionAction,
} from "@/actions/plan-review";
import type { PlanProposal } from "@/lib/plan-review";

export type PlanReviewCard = {
  planId: string;
  planName: string;
  insufficientData: boolean;
  proposals: PlanProposal[];
  /** Nieodwołana rewizja (trwałe „Cofnij”). */
  activeRevision: {
    id: string;
    kind: string;
    summary: string | null;
    date: string;
  } | null;
  mesocycleLabel: string;
};

export function PlanReviewClient({ cards }: { cards: PlanReviewCard[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function run(
    planId: string,
    p: PlanProposal,
    replaceCatalogId?: string,
  ) {
    setError(null);
    const base = {
      planId,
      kind: p.kind === "deload_week" ? ("deload" as const) : ("review" as const),
      summary: p.title,
    };
    const payload = replaceCatalogId
      ? {
          ...base,
          replace: { exerciseId: p.exerciseId!, catalogId: replaceCatalogId },
        }
      : p.bulk
        ? { ...base, changes: p.bulk }
        : p.exerciseId && p.change
          ? { ...base, changes: [{ exerciseId: p.exerciseId, ...p.change }] }
          : null;
    if (!payload) return;
    startTransition(async () => {
      const res = await applyPlanReviewAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function revert(revisionId: string) {
    setError(null);
    startTransition(async () => {
      const res = await revertPlanRevisionAction(revisionId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-[13px] text-rose-300">{error}</p> : null}
      {cards.map((c) => (
        <section key={c.planId} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-white">
              {c.planName}
            </h2>
            <span className="text-[11px] text-white/45">{c.mesocycleLabel}</span>
          </div>
          {c.activeRevision ? (
            <div className="app-panel flex items-center justify-between gap-3 px-3.5 py-3 text-[13px] text-white">
              <span className="min-w-0">
                {c.activeRevision.kind === "deload"
                  ? "Aktywny tydzień odciążenia"
                  : "Ostatnia zmiana planu"}
                {c.activeRevision.summary ? `: ${c.activeRevision.summary}` : ""}
                <span className="block text-[11px] text-white/45">
                  {c.activeRevision.date}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => revert(c.activeRevision!.id)}
                className="shrink-0 font-semibold text-[var(--gym-gold)] disabled:opacity-50"
              >
                {c.activeRevision.kind === "deload" ? "Przywróć plan" : "Cofnij"}
              </button>
            </div>
          ) : null}
          {c.insufficientData ? (
            <p className="app-panel px-3.5 py-3 text-[13px] text-white/55">
              Za mało treningów (min. 8), by proponować zmiany.
            </p>
          ) : c.proposals.length === 0 ? (
            <p className="app-panel px-3.5 py-3 text-[13px] text-white/55">
              Plan wygląda dobrze — brak propozycji zmian.
            </p>
          ) : (
            c.proposals
              .filter((p) => !dismissed.has(p.id))
              .map((p) => (
                <div key={p.id} className="app-panel space-y-2 px-3.5 py-3">
                  <p className="text-[14px] font-semibold text-white">
                    {p.title}
                  </p>
                  <p className="text-[12px] leading-4 text-white/60">
                    {p.reason}
                  </p>
                  {p.replaceOptions && p.replaceOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {p.replaceOptions.map((alt) => (
                        <button
                          key={alt.id}
                          type="button"
                          disabled={pending}
                          onClick={() => run(c.planId, p, alt.id)}
                          className="rounded-xl border border-white/15 px-3 py-1.5 text-[12px] text-white disabled:opacity-50"
                        >
                          Zamień na: {alt.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-4 pt-1 text-[12px] font-semibold uppercase tracking-[0.12em]">
                    {p.change || p.bulk ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(c.planId, p)}
                        className="text-[var(--gym-gold)] disabled:opacity-50"
                      >
                        Zastosuj
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setDismissed((s) => new Set(s).add(p.id))
                      }
                      className="text-white/40"
                    >
                      Odrzuć
                    </button>
                  </div>
                </div>
              ))
          )}
        </section>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useGhostTrainingStore } from "@/lib/stores/ghost-training";
import type { GhostTargetOption } from "@/lib/ghost-training/types";

export function GhostPickerSheet({ planId }: { planId: string | null }) {
  const setTimeline = useGhostTrainingStore((s) => s.setTimeline);
  const clear = useGhostTrainingStore((s) => s.clear);
  const enabled = useGhostTrainingStore((s) => s.enabled);
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<GhostTargetOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const qs = planId ? `?planId=${encodeURIComponent(planId)}` : "";
    fetch(`/api/ghost-training/targets${qs}`)
      .then((r) => r.json())
      .then((d: { targets?: GhostTargetOption[] }) => setTargets(d.targets ?? []))
      .catch(() => setTargets([]))
      .finally(() => setLoading(false));
  }, [open, planId]);

  async function select(t: GhostTargetOption) {
    if (!t.workoutId) return;
    const qs = new URLSearchParams({
      kind: t.kind,
      userId: t.userId,
      workoutId: t.workoutId,
    });
    const res = await fetch(`/api/ghost-training/timeline?${qs}`);
    if (!res.ok) return;
    const data = (await res.json()) as { timeline: Parameters<typeof setTimeline>[0] };
    setTimeline(data.timeline);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10 px-3 py-2 text-[12px] font-medium text-[var(--neon)]"
        >
          {enabled ? "Zmień Ghost" : "Ghost Training"}
        </button>
        {enabled ? (
          <button
            type="button"
            onClick={() => clear()}
            className="rounded-xl border border-white/15 px-3 py-2 text-[12px] text-white/50"
          >
            Wyłącz
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-md">
          <p className="text-[11px] uppercase tracking-wide text-white/40">
            Wybierz ducha
          </p>
          {loading ? (
            <p className="text-[13px] text-white/40">Ładowanie…</p>
          ) : targets.length === 0 ? (
            <p className="text-[13px] text-white/40">
              Brak dostępnych treningów (self / znajomi / lider).
            </p>
          ) : (
            targets.map((t) => (
              <button
                key={`${t.kind}-${t.userId}-${t.workoutId}`}
                type="button"
                onClick={() => void select(t)}
                className="flex w-full flex-col rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left hover:border-[var(--neon)]/40"
              >
                <span className="text-[13px] text-white">{t.label}</span>
                <span className="text-[11px] text-white/40">{t.subtitle}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

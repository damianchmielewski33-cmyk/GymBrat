"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Ghost } from "lucide-react";
import { GhostRaceHud } from "@/components/active-workout/ghost-race-hud";
import { Button } from "@/components/ui/button";
import { useGhostTrainingStore } from "@/lib/stores/ghost-training";
import type { GhostDelta, GhostTargetOption } from "@/lib/ghost-training/types";
import { cn } from "@/lib/utils";

const RESULT_LABEL: Record<GhostDelta["predicted"], string> = {
  winning: "wygrywasz",
  neck: "łeb w łeb",
  trailing: "rywal prowadzi",
};

type TargetsState =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; targets: GhostTargetOption[] };

/**
 * Plakietka Ghost w nagłówku sesji (D-1, LR-8): stan wyboru rywala, nie zapisu.
 * Panel: wybór rywala albo szczegóły wyścigu (`GhostRaceHud`).
 */
export function GhostPickerSheet({ planId }: { planId: string | null }) {
  const setTimeline = useGhostTrainingStore((s) => s.setTimeline);
  const clear = useGhostTrainingStore((s) => s.clear);
  const enabled = useGhostTrainingStore((s) => s.enabled);
  const timeline = useGhostTrainingStore((s) => s.timeline);
  const delta = useGhostTrainingStore((s) => s.delta);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [targets, setTargets] = useState<TargetsState>({ status: "idle" });
  const badgeRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  function loadTargets() {
    setTargets({ status: "loading" });
    const qs = planId ? `?planId=${encodeURIComponent(planId)}` : "";
    fetch(`/api/ghost-training/targets${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error("ghost-targets");
        return r.json();
      })
      .then((d: { targets?: GhostTargetOption[] }) =>
        setTargets({ status: "ready", targets: d.targets ?? [] }),
      )
      .catch(() => setTargets({ status: "error" }));
  }

  function close() {
    setOpen(false);
    badgeRef.current?.focus();
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    const pickNow = !enabled;
    setPicking(pickNow);
    setOpen(true);
    if (pickNow) loadTargets();
  }

  function startPicking() {
    setPicking(true);
    loadTargets();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      badgeRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
    setPicking(false);
    close();
  }

  const label = !enabled
    ? "Ghost: wybierz rywala"
    : delta
      ? `Ghost: ${RESULT_LABEL[delta.predicted]}`
      : `Ghost: ${timeline?.sourceLabel ?? ""}`;
  const ariaLabel = !enabled
    ? "Ghost: wybierz rywala do wyścigu. Twój trening zapisuje się normalnie"
    : `Wyścig Ghost z: ${timeline?.sourceLabel ?? ""}.${
        delta ? ` ${RESULT_LABEL[delta.predicted]}.` : ""
      } Pokaż szczegóły`;

  return (
    <div className="relative">
      {/* Pole dotyku 44 px, widoczna plakietka 28 px (kompakt 24). */}
      <button
        ref={badgeRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        className="-my-2 inline-flex h-11 items-center"
      >
        <span
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold text-[var(--gym-gold)] compact:h-6 compact:text-[11px]",
            enabled
              ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/16"
              : "border-[var(--gym-gold)]/38 bg-[var(--gym-gold)]/8",
          )}
        >
          <Ghost aria-hidden className="size-3.5" />
          {label}
          <ChevronDown aria-hidden className="size-3.5" />
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Ghost"
          className="absolute left-1/2 top-full z-30 mt-2 max-h-80 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 space-y-2 overflow-y-auto rounded-[18px] border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] p-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
          {enabled && !picking ? (
            <>
              <GhostRaceHud />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={startPicking}>
                  Zmień rywala
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clear();
                    close();
                  }}
                >
                  Wyłącz Ghost
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-white">Wybierz rywala</p>
              <p className="text-[12px] leading-4 text-[var(--gym-text-secondary)]">
                Ścigasz się z wcześniejszym treningiem. Twój dzisiejszy trening zapisuje się
                tak samo.
              </p>
              {targets.status === "loading" || targets.status === "idle" ? (
                <div className="space-y-2" aria-busy="true">
                  <div className="h-[52px] animate-pulse rounded-xl bg-white/[0.06] motion-reduce:animate-none" />
                  <div className="h-[52px] animate-pulse rounded-xl bg-white/[0.06] motion-reduce:animate-none" />
                </div>
              ) : targets.status === "error" ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-white">
                    Nie udało się wczytać rywali. Sprawdź połączenie i spróbuj ponownie.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={loadTargets}>
                    Spróbuj ponownie
                  </Button>
                </div>
              ) : targets.targets.length === 0 ? (
                <p className="text-[13px] text-white">
                  Brak treningu do wyścigu. Gdy ukończysz ten plan, pojawi się tutaj.
                </p>
              ) : (
                targets.targets.map((t) => (
                  <button
                    key={`${t.kind}-${t.userId}-${t.workoutId}`}
                    type="button"
                    onClick={() => void select(t)}
                    className="flex min-h-[52px] w-full flex-col justify-center rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)] px-3 py-2 text-left hover:border-[var(--gym-gold)]/40"
                  >
                    <span className="text-[13px] text-white">{t.label}</span>
                    <span className="text-[11px] text-[var(--gym-text-secondary)]">
                      {t.subtitle}
                    </span>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

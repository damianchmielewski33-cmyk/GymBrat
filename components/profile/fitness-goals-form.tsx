"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveFitnessGoalsAction } from "@/actions/fitness-goals";
import type { FitnessGoals } from "@/lib/fitness-goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Target } from "lucide-react";

export function FitnessGoalsForm({ initial }: { initial: FitnessGoals }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [weekly, setWeekly] = useState(
    initial.weeklySessionsTarget != null ? String(initial.weeklySessionsTarget) : "",
  );
  const [exName, setExName] = useState(initial.exerciseTargets?.[0]?.name ?? "");
  const [exKg, setExKg] = useState(
    initial.exerciseTargets?.[0]?.targetKg != null
      ? String(initial.exerciseTargets[0].targetKg)
      : "",
  );

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(600px_240px_at_0%_0%,rgba(255,45,85,0.12),transparent_60%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Postęp
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">Cele treningowe</h2>
            <p className="mt-2 text-sm text-white/60">
              Tygodniowa liczba dni z treningiem oraz opcjonalny cel ciężaru na jedno ćwiczenie
              (do podglądu na Start).
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Target className="h-5 w-5 text-[var(--neon)]" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/70">Dni z treningiem / tydzień</Label>
            <Input
              type="number"
              min={1}
              max={14}
              value={weekly}
              onChange={(e) => setWeekly(e.target.value)}
              placeholder="np. 4"
              className="h-11 border-white/12 bg-white/[0.05] text-white"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/70">Ćwiczenie (opcjonalnie)</Label>
            <Input
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              placeholder="np. Przysiad"
              className="h-11 border-white/12 bg-white/[0.05] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Cel (kg)</Label>
            <Input
              type="number"
              min={0}
              step="0.5"
              value={exKg}
              onChange={(e) => setExKg(e.target.value)}
              placeholder="np. 100"
              className="h-11 border-white/12 bg-white/[0.05] text-white"
            />
          </div>
        </div>

        <Button
          type="button"
          disabled={pending}
          className="h-11 bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
          onClick={() => {
            start(async () => {
              const wn = Number(weekly);
              const kn = exKg === "" ? undefined : Number(exKg);
              const payload: FitnessGoals = {};
              if (Number.isFinite(wn) && wn > 0) payload.weeklySessionsTarget = Math.round(wn);
              if (exName.trim() && kn != null && Number.isFinite(kn) && kn > 0) {
                payload.exerciseTargets = [{ name: exName.trim(), targetKg: kn }];
              }
              const r = await saveFitnessGoalsAction(payload);
              if (r.ok) {
                notifySaved("Zapisano cele.");
                router.refresh();
              } else notifyError(r.error ?? "Błąd zapisu.");
            });
          }}
        >
          Zapisz cele
        </Button>
      </div>
    </section>
  );
}

"use client";

import { Scale } from "lucide-react";
import { useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { logWeighIn } from "@/actions/weight";
import { Input } from "@/components/ui/input";

export function WeighInCard() {
  const { notifySaved } = useSaveFeedback();
  const [weightKg, setWeightKg] = useState<number>(80);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await logWeighIn({ weightKg });
      if (!res.ok) throw new Error(res.error);
      notifySaved("Zapisano ważenie.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać ważenia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Szybki wpis
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">Ważenie</h3>
          <p className="mt-1 text-sm text-white/45">
            Każdy wpis pojawia się na wykresie masy w Analizie i na Pulpicie.
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
          <Scale className="h-5 w-5 text-[var(--gym-gold)]" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <label className="text-xs text-white/55">Waga (kg)</label>
          <Input
            type="number"
            step="0.1"
            min={30}
            max={300}
            value={Number.isFinite(weightKg) ? weightKg : ""}
            onChange={(e) => setWeightKg(Number(e.target.value))}
            className="h-11 rounded-xl border-white/15 bg-black/40"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-b from-[#f0d56a] via-[#d4af37] to-[#b8922a] px-5 text-sm font-bold text-[#0a0906] disabled:opacity-50"
        >
          {saving ? "Zapis…" : "Zapisz"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
    </section>
  );
}

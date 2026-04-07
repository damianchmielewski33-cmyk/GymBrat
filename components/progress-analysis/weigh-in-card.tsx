"use client";

import { motion } from "framer-motion";
import { Plus, Scale } from "lucide-react";
import { useState } from "react";
import { logWeighIn } from "@/actions/weight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WeighInCard() {
  const [weightKg, setWeightKg] = useState<number>(80);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await logWeighIn({ weightKg });
      if (!res.ok) throw new Error(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać ważenia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="glass-panel relative overflow-hidden p-6"
    >
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:radial-gradient(520px_240px_at_10%_10%,rgba(255,45,85,0.18),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Szybki wpis
            </p>
            <h3 className="font-heading mt-1 text-lg font-semibold text-white">
              Ważenie
            </h3>
            <p className="mt-1 text-sm text-white/60">
              Dodaje punkt do wykresu wagi.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Scale className="h-5 w-5 text-[var(--neon)]" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label className="text-xs text-white/55">Waga (kg)</label>
            <Input
              type="number"
              step="0.1"
              min={1}
              max={600}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
            />
          </div>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-11 bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
          >
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Zapisywanie…" : "Dodaj"}
          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}


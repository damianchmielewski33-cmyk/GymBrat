"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveMealTemplateAction } from "@/actions/meal-quick";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import type { MealTemplate } from "@/lib/meal-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Bookmark } from "lucide-react";

export function MealTemplatesCard({ initial }: { initial: MealTemplate[] }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [p, setP] = useState("");
  const [f, setF] = useState("");
  const [c, setC] = useState("");
  const [kcal, setKcal] = useState("");

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(520px_220px_at_80%_100%,rgba(255,45,85,0.10),transparent_55%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Posiłki
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">Szablony na Start</h2>
            <p className="mt-2 text-sm text-white/60">
              Zapisz ulubione zestawy makro — pojawią się jako przyciski przy szybkich posiłkach.
            </p>
          </div>
          <Bookmark className="h-5 w-5 text-[var(--neon)]" aria-hidden />
        </div>

        {initial.length > 0 ? (
          <ul className="space-y-1 text-sm text-white/70">
            {initial.map((t) => (
              <li key={t.id}>
                <span className="font-medium text-white/85">{t.name}</span> · {Math.round(t.calories)}{" "}
                kcal · B {t.proteinG} / T {t.fatG} / W {t.carbsG}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/45">Brak szablonów — dodaj pierwszy poniżej.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nazwa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Koktajl proteinowy"
              className="border-white/12 bg-white/[0.05] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>Białko (g)</Label>
            <Input value={p} onChange={(e) => setP(e.target.value)} className="border-white/12 bg-white/[0.05] text-white" />
          </div>
          <div className="space-y-2">
            <Label>Tłuszcz (g)</Label>
            <Input value={f} onChange={(e) => setF(e.target.value)} className="border-white/12 bg-white/[0.05] text-white" />
          </div>
          <div className="space-y-2">
            <Label>Węgle (g)</Label>
            <Input value={c} onChange={(e) => setC(e.target.value)} className="border-white/12 bg-white/[0.05] text-white" />
          </div>
          <div className="space-y-2">
            <Label>Kcal (opcjonalnie)</Label>
            <Input value={kcal} onChange={(e) => setKcal(e.target.value)} className="border-white/12 bg-white/[0.05] text-white" />
          </div>
        </div>

        <Button
          type="button"
          disabled={pending}
          className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
          onClick={() => {
            start(async () => {
              const proteinG = Number(p) || 0;
              const fatG = Number(f) || 0;
              const carbsG = Number(c) || 0;
              const manualK = kcal === "" ? undefined : Number(kcal);
              const calories =
                manualK != null && Number.isFinite(manualK) && manualK > 0
                  ? manualK
                  : kcalFromMacros(proteinG, fatG, carbsG);
              if (!name.trim() || calories <= 0) {
                notifyError("Podaj nazwę i makro lub kcal.");
                return;
              }
              const r = await saveMealTemplateAction({
                name: name.trim(),
                calories,
                proteinG,
                fatG,
                carbsG,
              });
              if (r.ok) {
                notifySaved("Szablon zapisany.");
                setName("");
                setP("");
                setF("");
                setC("");
                setKcal("");
                router.refresh();
              } else notifyError("Nie udało się zapisać.");
            });
          }}
        >
          Dodaj szablon
        </Button>
      </div>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  addMealFromTemplateAction,
  repeatLastMealAction,
} from "@/actions/meal-quick";
import type { MealTemplate } from "@/lib/meal-templates";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Copy, UtensilsCrossed } from "lucide-react";

export function QuickMealStrip({
  dateKey,
  templates,
}: {
  dateKey: string;
  templates: MealTemplate[];
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();

  return (
    <section className="glass-panel relative overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(120deg,rgba(255,255,255,0.06),transparent_50%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-white/70">
          <UtensilsCrossed className="h-4 w-4 text-[var(--neon)]" aria-hidden />
          <p className="text-sm font-medium">Szybkie posiłki</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            onClick={() => {
              start(async () => {
                const r = await repeatLastMealAction(dateKey);
                if (r.ok) {
                  notifySaved("Powtórzono ostatni posiłek.");
                  router.refresh();
                } else notifyError(r.error);
              });
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Powtórz ostatni
          </Button>
          {templates.slice(0, 6).map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              className="border-white/10 bg-white/[0.06] text-white/85 hover:bg-white/[0.1]"
              onClick={() => {
                start(async () => {
                  const r = await addMealFromTemplateAction(dateKey, t.id);
                  if (r.ok) {
                    notifySaved(`Dodano: ${t.name}`);
                    router.refresh();
                  } else notifyError(r.error);
                });
              }}
            >
              {t.name}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

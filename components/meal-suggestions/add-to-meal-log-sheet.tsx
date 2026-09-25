"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";

export function AddToMealLogSheet({
  dateKey,
  presetName,
  triggerLabel = "Dodaj do dziennika",
  proteinG,
  fatG,
  carbsG,
  calories,
  defaultSlot = "obiad",
}: {
  dateKey: string;
  presetName: string;
  triggerLabel?: string;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  calories?: number;
  defaultSlot?: DietDiarySlot;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(presetName);
  const [kcal, setKcal] = useState(calories != null ? String(Math.round(calories)) : "");
  const [slot, setSlot] = useState<DietDiarySlot>(defaultSlot);
  const [state, formAction] = useActionState(addMealLogAction, {} as MealLogFormState);

  useEffect(() => {
    if (!open) return;
    setName(presetName);
    setKcal(calories != null ? String(Math.round(calories)) : "");
    setSlot(defaultSlot);
  }, [open, presetName, calories, defaultSlot]);

  useEffect(() => {
    if (state?.ok) {
      notifySaved("Posiłek dodany do dziennika.");
      setOpen(false);
      router.refresh();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, notifyError, notifySaved, router]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 text-xs font-semibold text-white/85 transition hover:bg-white/[0.07]"
      >
        {triggerLabel}
      </button>
      <SheetContent side="bottom" className="border-white/10 bg-[#07070c] text-white">
        <SheetHeader>
          <SheetTitle className="text-white">Dodaj posiłek</SheetTitle>
          <SheetDescription className="text-white/55">
            Wpis do dziennika na dzień <span className="font-mono">{dateKey}</span> — wybierz sekcję
            jak w Fitatu.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4 px-4 pb-6">
          <input type="hidden" name="date" value={dateKey} />
          <input type="hidden" name="slot" value={slot} />
          <input type="hidden" name="proteinG" value={proteinG != null ? String(proteinG) : "0"} />
          <input type="hidden" name="fatG" value={fatG != null ? String(fatG) : "0"} />
          <input type="hidden" name="carbsG" value={carbsG != null ? String(carbsG) : "0"} />
          <div className="space-y-2">
            <Label className="text-white/75">Nazwa</Label>
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {(proteinG != null || fatG != null || carbsG != null) && (
            <p className="text-xs tabular-nums text-[var(--neon)]">
              Makro: {Math.round(proteinG ?? 0)}B · {Math.round(carbsG ?? 0)}W ·{" "}
              {Math.round(fatG ?? 0)}T
              {calories != null ? ` · ${Math.round(calories)} kcal` : ""}
            </p>
          )}
          <div className="space-y-2">
            <Label className="text-white/75">Sekcja</Label>
            <div className="flex flex-wrap gap-2">
              {DIET_DIARY_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={
                    slot === s
                      ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70"
                  }
                >
                  {DIET_DIARY_SLOT_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-white/75">Kalorie (kcal)</Label>
            <Input
              name="calories"
              inputMode="decimal"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="np. 550"
            />
          </div>
          <SheetFooter className="flex flex-row gap-2 px-0">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" variant="cta" className="flex-[1.2]">
              Dodaj
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

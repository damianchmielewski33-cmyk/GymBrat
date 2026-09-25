"use client";

import { useEffect, useState, useActionState } from "react";
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

export function AddToMealLogSheet({
  dateKey,
  presetName,
  triggerLabel = "Dodaj do dziennika",
  proteinG,
  fatG,
  carbsG,
  calories,
}: {
  dateKey: string;
  presetName: string;
  triggerLabel?: string;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  calories?: number;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(presetName);
  const [kcal, setKcal] = useState(calories != null ? String(Math.round(calories)) : "");
  const [state, formAction] = useActionState(addMealLogAction, {} as MealLogFormState);

  useEffect(() => {
    if (!open) return;
    setName(presetName);
    setKcal(calories != null ? String(Math.round(calories)) : "");
  }, [open, presetName, calories]);

  useEffect(() => {
    if (state?.ok) {
      notifySaved("Posiłek dodany do dziennika.");
      setOpen(false);
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, notifyError, notifySaved]);

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
            Szybki wpis do dziennika na dzień <span className="font-mono">{dateKey}</span>.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4 px-4 pb-6">
          <input type="hidden" name="date" value={dateKey} />
          <input type="hidden" name="proteinG" value={proteinG != null ? String(proteinG) : "0"} />
          <input type="hidden" name="fatG" value={fatG != null ? String(fatG) : "0"} />
          <input type="hidden" name="carbsG" value={carbsG != null ? String(carbsG) : "0"} />
          <div className="space-y-2">
            <Label className="text-white/75">Nazwa</Label>
            <Input name="name" value={name} onChange={(e) => setName(e.target.value)} />
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
            <p className="text-xs text-white/45">
              Jeśli nie znasz makro, wystarczy kcal. Makro uzupełnisz później w edycji wpisu na stronie
              Start.
            </p>
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

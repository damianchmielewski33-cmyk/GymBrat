"use client";

import { useActionState, useEffect, useState } from "react";
import { updateMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { SubmitButton } from "@/components/home/submit-button";
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
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { MealLogDto } from "@/lib/meal-logs";
import { kcalFromMacros, parseMacroGrams } from "@/lib/kcal-from-macros";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Calculator } from "lucide-react";

export function EditMealLogSheet({
  entry,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: MealLogDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, action] = useActionState(updateMealLogAction, {} as MealLogFormState);
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<DietDiarySlot | "">("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [kcal, setKcal] = useState("");

  useEffect(() => {
    if (!entry || !open) return;
    setName(entry.name ?? "");
    setSlot(entry.slot ?? "");
    setProtein(entry.proteinG ? String(entry.proteinG) : "");
    setFat(entry.fatG ? String(entry.fatG) : "");
    setCarbs(entry.carbsG ? String(entry.carbsG) : "");
    setKcal(entry.calories ? String(Math.round(entry.calories)) : "");
  }, [entry, open]);

  useEffect(() => {
    if (!open) return;
    if (state?.ok) {
      notifySaved("Zapisano zmiany wpisu.");
      onSaved();
      onOpenChange(false);
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, open, notifySaved, notifyError, onSaved, onOpenChange]);

  if (!entry) return null;

  const p = parseMacroGrams(protein);
  const f = parseMacroGrams(fat);
  const c = parseMacroGrams(carbs);
  const hasMacros = p > 0 || f > 0 || c > 0;
  const computed = hasMacros ? kcalFromMacros(p, f, c) : null;
  const manual = parseMacroGrams(kcal);
  const finalKcal = manual > 0 ? Math.round(manual) : computed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(92vh,680px)] flex-col border-white/10 bg-[#07070c] text-white"
      >
        <SheetHeader className="shrink-0 space-y-1 pb-2">
          <SheetTitle className="font-heading text-lg text-white">Edytuj wpis</SheetTitle>
          <SheetDescription className="text-white/50">
            Zmień nazwę, sekcję dnia albo makro — bez usuwania i dodawania od nowa.
          </SheetDescription>
        </SheetHeader>

        <form
          key={entry.id}
          action={action}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4"
        >
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="date" value={entry.date} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-meal-name">Nazwa</Label>
            <Input
              id="edit-meal-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 border-white/12 bg-white/[0.06] text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-meal-slot">Sekcja</Label>
            <select
              id="edit-meal-slot"
              name="slot"
              value={slot}
              onChange={(e) => setSlot(e.target.value as DietDiarySlot | "")}
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm text-white outline-none"
            >
              <option value="">Bez sekcji</option>
              {DIET_DIARY_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {DIET_DIARY_SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="edit-p">Białko (g)</Label>
              <Input
                id="edit-p"
                name="proteinG"
                inputMode="decimal"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="h-11 border-white/12 bg-white/[0.06] text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-c">Węgle (g)</Label>
              <Input
                id="edit-c"
                name="carbsG"
                inputMode="decimal"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="h-11 border-white/12 bg-white/[0.06] text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-f">Tłuszcz (g)</Label>
              <Input
                id="edit-f"
                name="fatG"
                inputMode="decimal"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="h-11 border-white/12 bg-white/[0.06] text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-kcal">Kalorie (opcjonalnie nadpisz)</Label>
            <Input
              id="edit-kcal"
              name="calories"
              inputMode="decimal"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder={computed != null ? String(computed) : ""}
              className="h-11 border-white/12 bg-white/[0.06] text-white"
            />
            {finalKcal != null ? (
              <p className="flex items-center gap-1.5 text-xs text-white/45">
                <Calculator className="h-3.5 w-3.5" />
                Do zapisu: {finalKcal} kcal
              </p>
            ) : null}
          </div>

          <SheetFooter className="mt-auto flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <SubmitButton className="flex-1">Zapisz</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { MealLogDto } from "@/lib/meal-logs";
import { deleteMealLogFormAction, type MealLogFormState } from "@/actions/meal-log";
import { FoodSearchScan } from "@/components/meal-suggestions/food-search-scan";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Plus, Trash2 } from "lucide-react";

function SlotTotals({ entries }: { entries: MealLogDto[] }) {
  const p = entries.reduce((s, e) => s + e.proteinG, 0);
  const c = entries.reduce((s, e) => s + e.carbsG, 0);
  const f = entries.reduce((s, e) => s + e.fatG, 0);
  const kcal = entries.reduce((s, e) => s + e.calories, 0);
  if (entries.length === 0) return null;
  return (
    <p className="text-xs tabular-nums text-white/45">
      Σ {Math.round(kcal)} kcal · {Math.round(p)}B · {Math.round(c)}W · {Math.round(f)}T
    </p>
  );
}

function DeleteMealButton({ id }: { id: string }) {
  const [state, action] = useActionState(deleteMealLogFormAction, {} as MealLogFormState);
  const { notifySaved } = useSaveFeedback();
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      notifySaved("Usunięto wpis.");
      router.refresh();
    }
  }, [state?.ok, notifySaved, router]);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Usunąć ten produkt z dziennika?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/20 text-rose-200/90 hover:bg-rose-500/15"
        aria-label="Usuń"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export function DietDiarySections({
  dateKey,
  entries,
  defaultSlot,
}: {
  dateKey: string;
  entries: MealLogDto[];
  defaultSlot: DietDiarySlot;
}) {
  const router = useRouter();
  const [addFor, setAddFor] = useState<DietDiarySlot | null>(null);

  const bySlot = (slot: DietDiarySlot) =>
    entries.filter((e) => e.slot === slot);

  const unassigned = entries.filter((e) => e.slot == null);

  return (
    <section className="space-y-3 pb-6">
      <div className="px-0.5">
        <p className="app-label">Dziennik dnia</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Posiłki jak w Fitatu</h2>
        <p className="mt-1 text-sm text-white/55">
          Śniadanie, drugie śniadanie, lunch, obiad i przekąska — dodawaj produkty ze skanu lub
          wyszukiwania.
        </p>
      </div>

      {DIET_DIARY_SLOTS.map((slot) => {
        const items = bySlot(slot);
        return (
          <div key={slot} className="app-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-white">
                  {DIET_DIARY_SLOT_LABELS[slot]}
                </h3>
                <SlotTotals entries={items} />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => setAddFor(slot)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Dodaj
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-4 text-sm text-white/40">Brak produktów w tej sekcji.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {items.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {e.name?.trim() || "Posiłek"}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-white/45">
                        {Math.round(e.calories)} kcal · {Math.round(e.proteinG)}B ·{" "}
                        {Math.round(e.carbsG)}W · {Math.round(e.fatG)}T
                      </p>
                    </div>
                    <DeleteMealButton id={e.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {unassigned.length > 0 ? (
        <div className="app-card overflow-hidden border-dashed border-white/15">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h3 className="text-sm font-semibold text-white/80">Bez sekcji</h3>
            <p className="text-xs text-white/40">Starsze wpisy — możesz je usunąć i dodać ponownie.</p>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {unassigned.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">{e.name?.trim() || "Posiłek"}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-white/40">
                    {Math.round(e.calories)} kcal · {Math.round(e.proteinG)}B ·{" "}
                    {Math.round(e.carbsG)}W · {Math.round(e.fatG)}T
                  </p>
                </div>
                <DeleteMealButton id={e.id} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Sheet open={addFor != null} onOpenChange={(o) => !o && setAddFor(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#07070c] p-0 text-white"
        >
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="text-white">
              Dodaj do {addFor ? DIET_DIARY_SLOT_LABELS[addFor] : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-4">
            {addFor ? (
              <FoodSearchScan
                dateKey={dateKey}
                defaultSlot={addFor}
                lockedSlot={addFor}
                initialOpen
                onAdded={() => {
                  setAddFor(null);
                  router.refresh();
                }}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

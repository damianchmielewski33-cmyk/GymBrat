"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { kcalFromMacros, parseMacroGrams } from "@/lib/kcal-from-macros";
import { Calculator, CheckCircle2, Flame, UtensilsCrossed } from "lucide-react";

function AddMealSheetForm({
  dateKey,
  onCloseSheet,
}: {
  dateKey: string;
  onCloseSheet: () => void;
}) {
  const { notifySaved } = useSaveFeedback();
  const [state, formAction] = useActionState(addMealLogAction, {} as MealLogFormState);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const suppressSheetCloseRef = useRef(false);

  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [kcal, setKcal] = useState("");

  const p = parseMacroGrams(protein);
  const f = parseMacroGrams(fat);
  const c = parseMacroGrams(carbs);
  const hasMacros = p > 0 || f > 0 || c > 0;
  const computedKcal = hasMacros ? kcalFromMacros(p, f, c) : null;
  const manualKcal = parseMacroGrams(kcal);
  const hasManualKcal = manualKcal > 0;
  const finalKcal = hasManualKcal ? Math.round(manualKcal) : computedKcal;

  function resetFields() {
    setName("");
    setProtein("");
    setFat("");
    setCarbs("");
    setKcal("");
  }

  useEffect(() => {
    if (state?.ok) {
      notifySaved("Posiłek został zapisany.");
      setFollowUpOpen(true);
    }
  }, [state, notifySaved]);

  function handleAddAnother() {
    suppressSheetCloseRef.current = true;
    setFollowUpOpen(false);
    resetFields();
  }

  function handleFollowUpOpenChange(next: boolean) {
    setFollowUpOpen(next);
    if (!next) {
      if (suppressSheetCloseRef.current) {
        suppressSheetCloseRef.current = false;
      } else {
        onCloseSheet();
      }
    }
  }

  const inputClass =
    "h-11 min-h-11 rounded-xl border-white/14 bg-white/[0.08] px-3.5 text-[15px] text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-white/38 focus-visible:border-[var(--neon)]/50 focus-visible:ring-[3px] focus-visible:ring-ring/85 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070c]";

  return (
    <>
      <AlertDialog open={followUpOpen} onOpenChange={handleFollowUpOpenChange}>
        <AlertDialogContent className="w-[min(92vw,420px)] border-white/10 bg-zinc-950/98">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10"
              aria-hidden
            >
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle>Dodałeś posiłek</AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-white/65">
                Posiłek został zapisany. Czy chcesz dodać kolejny?
              </AlertDialogDescription>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              onClick={() => handleFollowUpOpenChange(false)}
            >
              Nie
            </Button>
            <Button
              type="button"
              className="h-11 bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
              onClick={handleAddAnother}
            >
              Tak, dodaj kolejny
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--neon)]/45 to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-16 h-48 w-48 rounded-full bg-[var(--neon)]/12 blur-3xl" />

      <SheetHeader className="relative shrink-0 space-y-1 px-1 pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.02] shadow-lg shadow-black/40">
            <UtensilsCrossed className="h-5 w-5 text-[var(--neon)]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="font-heading text-lg leading-tight text-white sm:text-xl">
              Dodaj posiłek
            </SheetTitle>
            <SheetDescription className="text-[13px] leading-snug text-white/50">
              Dzień <span className="font-mono text-white/70">{dateKey}</span>. Kalorie możesz
              wyliczyć z makroskładników (4·B + 4·W + 9·T) albo wpisać ręcznie.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <form
        action={formAction}
        className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-2"
      >
        <input type="hidden" name="date" value={dateKey} />
        <input type="hidden" name="proteinG" value={p ? String(p) : ""} />
        <input type="hidden" name="fatG" value={f ? String(f) : ""} />
        <input type="hidden" name="carbsG" value={c ? String(c) : ""} />
        <input type="hidden" name="calories" value={hasManualKcal ? String(finalKcal) : ""} />

        <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
          <Label
            htmlFor="meal-name"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60"
          >
            Nazwa
          </Label>
          <Input
            id="meal-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Owsianka, bowl z kurczakiem…"
            className={inputClass}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              Wartości odżywcze
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/40">
              <Calculator className="h-3 w-3" />
              4·B + 4·W + 9·T
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meal-p" className="text-xs text-white/78">
                Białko
              </Label>
              <div className="relative">
                <Input
                  id="meal-p"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="—"
                  className={`${inputClass} pr-9`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
                  g
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meal-f" className="text-xs text-white/78">
                Tłuszcz
              </Label>
              <div className="relative">
                <Input
                  id="meal-f"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="—"
                  className={`${inputClass} pr-9`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
                  g
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meal-c" className="text-xs text-white/78">
                Węgle
              </Label>
              <div className="relative">
                <Input
                  id="meal-c"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="—"
                  className={`${inputClass} pr-9`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
                  g
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 transition-colors ${
            hasMacros
              ? "border-emerald-500/25 bg-emerald-500/[0.07]"
              : "border-white/[0.08] bg-white/[0.03]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">
              <Flame className="h-5 w-5 text-orange-300/90" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Kalorie
              </p>
              {finalKcal != null ? (
                <>
                  <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-white">
                    {finalKcal}{" "}
                    <span className="text-lg font-normal text-white/45">kcal</span>
                  </p>
                  <p className="text-xs text-emerald-200/75">
                    {hasManualKcal
                      ? "Nadpisane ręcznie · zostanie zapisane jako kcal wpisu"
                      : "Wyliczone z makroskładników · zmiana gramów aktualizuje wartość"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-white/45">
                  Uzupełnij makroskładniki lub wpisz kcal ręcznie.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
          <Label
            htmlFor="meal-kcal"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60"
          >
            Kcal (opcjonalnie)
          </Label>
          <div className="relative">
            <Input
              id="meal-kcal"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder={computedKcal != null ? String(computedKcal) : "—"}
              className={`${inputClass} pr-16`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
              kcal
            </span>
          </div>
          <p className="text-xs text-white/45">
            Jeśli wpiszesz kcal, aplikacja zapisze je dokładnie tak (np. z etykiety / Fitatu).
            Jeśli zostawisz puste, wyliczymy z makroskładników (4·B + 4·W + 9·T).
          </p>
        </div>

        {state?.error ? (
          <div
            id="add-meal-form-error"
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
          >
            {state.error}
          </div>
        ) : null}

        <SheetFooter className="sticky bottom-0 mt-auto flex shrink-0 flex-row gap-2 border-t border-white/[0.06] bg-[#07070c]/95 pt-4 backdrop-blur-md sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 border-white/15 bg-white/[0.04] text-white hover:bg-white/10 sm:flex-none"
            onClick={() => {
              resetFields();
              onCloseSheet();
            }}
          >
            Anuluj
          </Button>
          <SubmitButton className="h-11 flex-[1.2] bg-[var(--neon)] text-white hover:bg-[#ff4d6d] sm:flex-none sm:min-w-[10rem]">
            Zapisz posiłek
          </SubmitButton>
        </SheetFooter>
      </form>
    </>
  );
}

export function AddMealSheet({ dateKey }: { dateKey: string }) {
  const [open, setOpen] = useState(false);
  const [mountKey, setMountKey] = useState(0);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setMountKey((k) => k + 1);
        setOpen(next);
      }}
    >
      <SheetTrigger className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-medium text-white transition outline-none hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-ring/85 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto">
        <UtensilsCrossed className="mr-2 h-4 w-4 opacity-90" />
        Dodaj posiłek
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[min(92vh,760px)] flex-col border-white/10 bg-[#07070c] pb-[env(safe-area-inset-bottom)] text-white"
      >
        <AddMealSheetForm key={mountKey} dateKey={dateKey} onCloseSheet={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

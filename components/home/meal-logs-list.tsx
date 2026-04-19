"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteMealLogFormAction,
  updateMealLogAction,
  type MealLogFormState,
} from "@/actions/meal-log";
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
import type { MealLogDto } from "@/lib/meal-logs";
import { kcalFromMacros, parseMacroGrams } from "@/lib/kcal-from-macros";
import { Calculator, Flame, Pencil, Trash2 } from "lucide-react";

function formatTime(ms: number) {
  try {
    return new Date(ms).toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MealLogsList({
  entries,
  dateKey,
}: {
  entries: MealLogDto[];
  dateKey: string;
}) {
  const [editing, setEditing] = useState<MealLogDto | null>(null);
  const [updateState, updateAction] = useActionState(
    updateMealLogAction,
    {} as MealLogFormState,
  );

  const [editName, setEditName] = useState("");
  const [editP, setEditP] = useState("");
  const [editF, setEditF] = useState("");
  const [editC, setEditC] = useState("");

  useEffect(() => {
    if (!editing) return;
    setEditName(editing.name ?? "");
    setEditP(editing.proteinG ? String(editing.proteinG) : "");
    setEditF(editing.fatG ? String(editing.fatG) : "");
    setEditC(editing.carbsG ? String(editing.carbsG) : "");
  }, [editing]);

  useEffect(() => {
    if (updateState?.ok) {
      setEditing(null);
    }
  }, [updateState?.ok]);

  const ep = parseMacroGrams(editP);
  const ef = parseMacroGrams(editF);
  const ec = parseMacroGrams(editC);
  const editHasMacros = ep > 0 || ef > 0 || ec > 0;
  const editKcal = editHasMacros ? kcalFromMacros(ep, ef, ec) : null;

  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.06] px-3.5 text-[15px] text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-white/25 focus-visible:border-[var(--neon)]/40 focus-visible:ring-2 focus-visible:ring-[var(--neon)]/25";

  return (
    <div className="glass-panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[var(--neon)]/8 blur-3xl" />
      <div className="relative">
        <h3 className="font-heading text-lg font-semibold text-white">
          Twoje posiłki ({dateKey})
        </h3>
        <p className="mt-1 text-sm text-white/50">
          Lista wpisów liczących się do spożycia na dziś — edytuj lub usuń wpis. Kalorie z
          makr (4·B + 4·W + 9·T).
        </p>

        {entries.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
            Brak wpisów na ten dzień. Użyj przycisku „Dodaj Posiłek”, aby je dodać.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {entries.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">
                    {m.name?.trim() ? m.name : "Posiłek"}
                  </p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {formatTime(m.createdAtMs)}
                  </p>
                  <p className="mt-2 font-mono text-xs text-white/65">
                    {Math.round(m.calories)} kcal · B {Math.round(m.proteinG)} g · T{" "}
                    {Math.round(m.fatG)} g · W {Math.round(m.carbsG)} g
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/15 bg-white/5"
                    onClick={() => setEditing(m)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edytuj
                  </Button>
                  <form
                    action={deleteMealLogFormAction}
                    onSubmit={(e) => {
                      if (
                        !confirm(
                          "Usunąć ten wpis posiłku? Spożycie na dziś zostanie przeliczone.",
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Usuń
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent
          side="bottom"
          className="flex max-h-[min(92vh,680px)] flex-col border-white/10 bg-[#07070c] text-white"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--neon)]/45 to-transparent" />

          <SheetHeader className="relative shrink-0 space-y-1 pb-2">
            <SheetTitle className="font-heading text-lg text-white">
              Edytuj posiłek
            </SheetTitle>
            <SheetDescription className="text-[13px] text-white/50">
              Dzień {dateKey}. Kalorie wyłącznie z makr (4·B + 4·W + 9·T).
            </SheetDescription>
          </SheetHeader>

          {editing ? (
            <form
              key={editing.id}
              action={updateAction}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-2"
            >
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="date" value={dateKey} />

              <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Nazwa
                </Label>
                <Input
                  name="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="np. Drugie śniadanie"
                  className={inputClass}
                />
              </div>

              <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Makra
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/40">
                    <Calculator className="h-3 w-3" />
                    4·B + 4·W + 9·T
                  </span>
                </div>
                <input type="hidden" name="proteinG" value={ep ? String(ep) : ""} />
                <input type="hidden" name="fatG" value={ef ? String(ef) : ""} />
                <input type="hidden" name="carbsG" value={ec ? String(ec) : ""} />

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/65">Białko</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={editP}
                        onChange={(e) => setEditP(e.target.value)}
                        placeholder="—"
                        className={`${inputClass} pr-9`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
                        g
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/65">Tłuszcz</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={editF}
                        onChange={(e) => setEditF(e.target.value)}
                        placeholder="—"
                        className={`${inputClass} pr-9`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/35">
                        g
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/65">Węgle</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={editC}
                        onChange={(e) => setEditC(e.target.value)}
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
                className={`rounded-2xl border p-4 ${
                  editHasMacros
                    ? "border-emerald-500/25 bg-emerald-500/[0.07]"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25">
                    <Flame className="h-5 w-5 text-orange-300/90" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      Kalorie
                    </p>
                    {editHasMacros ? (
                      <p className="font-heading text-3xl font-semibold tabular-nums text-white">
                        {editKcal}{" "}
                        <span className="text-lg font-normal text-white/45">kcal</span>
                      </p>
                    ) : (
                      <p className="text-sm text-white/45">
                        Uzupełnij makra — kcal wyliczymy automatycznie.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {updateState?.error ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/95">
                  {updateState.error}
                </div>
              ) : null}

              <SheetFooter className="sticky bottom-0 mt-auto flex shrink-0 flex-row gap-2 border-t border-white/[0.06] bg-[#07070c]/95 pt-4 backdrop-blur-md sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 border-white/15 bg-white/[0.04] sm:flex-none"
                  onClick={() => setEditing(null)}
                >
                  Anuluj
                </Button>
                <SubmitButton className="h-11 flex-[1.2] bg-[var(--neon)] text-white hover:bg-[#ff4d6d] sm:flex-none sm:min-w-[10rem]">
                  Zapisz zmiany
                </SubmitButton>
              </SheetFooter>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

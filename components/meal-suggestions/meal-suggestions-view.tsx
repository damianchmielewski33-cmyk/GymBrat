"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import { mealIllustrationUrl } from "@/lib/meal-suggestions-gaps";
import type { MealSuggestionItem } from "@/lib/meal-suggestions-schema";
import { generateMealSuggestionsAction } from "@/actions/meal-suggestions";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { ChefHat, Loader2, Sparkles } from "lucide-react";
import type { WebMealInspiration } from "@/lib/web-meal-inspirations";
import type { MealTemplate } from "@/lib/meal-templates";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMealLogAction, type MealLogFormState } from "@/actions/meal-log";
import { useActionState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";

function fmtVal(n: number, kind: "kcal" | "g") {
  if (!Number.isFinite(n)) return "—";
  if (kind === "kcal") return `${Math.round(n)} kcal`;
  return `${Math.round(n * 10) / 10} g`;
}

function fmtRem(n: number | null, kind: "kcal" | "g") {
  if (n == null) return "—";
  return fmtVal(n, kind);
}

function GapRow({
  label,
  consumed,
  goal,
  remaining,
  kind,
}: {
  label: string;
  consumed: number;
  goal: number | null;
  remaining: number | null;
  kind: "kcal" | "g";
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm sm:grid-cols-4">
      <span className="font-medium text-white/90">{label}</span>
      <span className="text-white/60">
        Spożyte: <span className="text-white/85">{fmtVal(consumed, kind)}</span>
      </span>
      <span className="text-white/60">
        Cel: <span className="text-white/85">{goal != null ? fmtVal(goal, kind) : "—"}</span>
      </span>
      <span className="text-[var(--neon)]">
        Zostało: <span className="font-semibold">{fmtRem(remaining, kind)}</span>
      </span>
    </div>
  );
}

function fmtMacro(n: number, unit: string) {
  return `${Math.round(n * 10) / 10} ${unit}`;
}

function AddToMealLogSheet({
  dateKey,
  presetName,
  triggerLabel = "Dodaj do dziennika",
}: {
  dateKey: string;
  presetName: string;
  triggerLabel?: string;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(presetName);
  const [kcal, setKcal] = useState("");
  const [state, formAction] = useActionState(addMealLogAction, {} as MealLogFormState);

  useEffect(() => {
    if (!open) return;
    setName(presetName);
    setKcal("");
  }, [open, presetName]);

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
          <input type="hidden" name="proteinG" value="0" />
          <input type="hidden" name="fatG" value="0" />
          <input type="hidden" name="carbsG" value="0" />
          <div className="space-y-2">
            <Label className="text-white/75">Nazwa</Label>
            <Input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
              Jeśli nie znasz makro, wystarczy kcal. Makro uzupełnisz później w edycji wpisu na stronie Start.
            </p>
          </div>
          <SheetFooter className="flex flex-row gap-2 px-0">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
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

export function MealSuggestionsView({
  initialSummary,
  initialGaps,
  modelAllowed,
  webInspirations,
  mealTemplates = [],
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  /** Dostawca AI skonfigurowany i użytkownik nie wyłączył AI w profilu */
  modelAllowed: boolean;
  /** Regularnie odświeżane inspiracje z internetu (linki do przepisów) */
  webInspirations: WebMealInspiration[] | null;
  mealTemplates?: MealTemplate[];
}) {
  const [gaps, setGaps] = useState(initialGaps);
  const [meals, setMeals] = useState<MealSuggestionItem[] | null>(null);
  const [source, setSource] = useState<"ai" | "static" | "user_disabled" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [inspirationFilter, setInspirationFilter] = useState<"all" | "high_protein" | "low_calorie" | "fast">("all");
  const [inspirationQuery, setInspirationQuery] = useState("");
  const cacheKeyRef = useRef(`meal-suggestions:last:${initialGaps.dateKey}`);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKeyRef.current);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { meals?: MealSuggestionItem[]; source?: string };
      if (Array.isArray(parsed.meals) && parsed.meals.length > 0) {
        setMeals(parsed.meals);
        if (parsed.source === "ai" || parsed.source === "static" || parsed.source === "user_disabled") {
          setSource(parsed.source);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  function generate() {
    setError(null);
    start(async () => {
      const r = await generateMealSuggestionsAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMeals(r.meals);
      setSource(r.source);
      setGaps(r.gaps);
      try {
        localStorage.setItem(cacheKeyRef.current, JSON.stringify({ meals: r.meals, source: r.source }));
      } catch {
        /* ignore */
      }
    });
  }

  const filteredInspirations = useMemo(() => {
    const list = webInspirations ?? [];
    const q = inspirationQuery.trim().toLowerCase();
    const protein = gaps.proteinRemaining ?? 0;
    const calories = gaps.caloriesRemaining ?? 99999;
    return list
      .filter((it) => {
        if (!q) return true;
        return (it.title + " " + it.snippet).toLowerCase().includes(q);
      })
      .filter((it) => {
        if (inspirationFilter === "all") return true;
        if (inspirationFilter === "fast") return /15|minut|szybk|ekspres/i.test(it.title + " " + it.snippet);
        if (inspirationFilter === "high_protein") return protein >= 30;
        if (inspirationFilter === "low_calorie") return calories <= 500;
        return true;
      });
  }, [webInspirations, inspirationQuery, inspirationFilter, gaps.proteinRemaining, gaps.caloriesRemaining]);

  return (
    <div className="space-y-3">
      <header className="px-0.5 pb-1 pt-2">
        <p className="app-label">Dieta</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-tight text-white">
          Twój plan żywieniowy
        </h1>
      </header>

      <section className="app-card p-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-[var(--neon)]" aria-hidden />
              <h2 className="text-lg font-semibold text-white">Dziś</h2>
            </div>
            <Button
              type="button"
              variant="cta"
              disabled={pending}
              onClick={() => generate()}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Generuję…
                </>
              ) : (
                <>
                  {modelAllowed ? <Sparkles className="mr-2 h-4 w-4" aria-hidden /> : null}
                  {modelAllowed ? "Wygeneruj propozycje" : "Pokaż propozycje"}
                </>
              )}
            </Button>
          </div>

          {initialSummary.source === "error" ? (
            <InlineBanner variant="warning">
              {initialSummary.errorMessage ?? "Nie udało się pobrać danych odżywczych."}
            </InlineBanner>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="app-label">Białko</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.proteinGoal != null ? `${Math.round(gaps.proteinGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="app-label">Węgle</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.carbsGoal != null ? `${Math.round(gaps.carbsGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="app-label">Tłuszcz</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.fatGoal != null ? `${Math.round(gaps.fatGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="app-label">Kalorie</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.caloriesGoal != null ? `${Math.round(gaps.caloriesGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">kcal</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <GapRow
                  label="Kalorie"
                  consumed={gaps.caloriesConsumed}
                  goal={gaps.caloriesGoal}
                  remaining={gaps.caloriesRemaining}
                  kind="kcal"
                />
                <GapRow
                  label="Białko"
                  consumed={gaps.proteinConsumed}
                  goal={gaps.proteinGoal}
                  remaining={gaps.proteinRemaining}
                  kind="g"
                />
                <GapRow
                  label="Tłuszcz"
                  consumed={gaps.fatConsumed}
                  goal={gaps.fatGoal}
                  remaining={gaps.fatRemaining}
                  kind="g"
                />
                <GapRow
                  label="Węglowodany"
                  consumed={gaps.carbsConsumed}
                  goal={gaps.carbsGoal}
                  remaining={gaps.carbsRemaining}
                  kind="g"
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.05] pt-4">
            <p className="app-label">Rozkład posiłków</p>
            <p className="mt-2 text-sm text-white/45">
              Stuknij posiłek, żeby zobaczyć dopasowane dania.
            </p>
            <div className="mt-3 divide-y divide-white/[0.05]">
              {(mealTemplates.length > 0
                ? mealTemplates
                : initialSummary.meals.map((m, i) => ({
                    id: m.id,
                    name: m.name || `Posiłek ${i + 1}`,
                    calories: m.calories,
                    proteinG: m.proteinG,
                    fatG: m.fatG,
                    carbsG: m.carbsG,
                  }))
              ).map((meal, i) => (
                <div
                  key={meal.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {i + 1}. {meal.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                    {Math.round(meal.proteinG)}B · {Math.round(meal.carbsG)}W · {Math.round(meal.fatG)}T
                  </p>
                </div>
              ))}
              {mealTemplates.length === 0 && initialSummary.meals.length === 0 ? (
                <p className="py-3 text-sm text-white/40">
                  Dodaj szablony posiłków w profilu albo wpisz posiłek w dzienniku.
                </p>
              ) : null}
            </div>
          </div>

          {!gaps.hasAnyMacroGoal ? (
            <p className="text-sm text-white/55">
              Uzupełnij cele kaloryczne i makro w{" "}
              <a href="/profile" className="text-[var(--neon)] underline-offset-4 hover:underline">
                profilu
              </a>
              , aby precyzyjniej domykać braki — model i tak zaproponuje zbilansowane posiłki.
            </p>
          ) : null}

          {!modelAllowed ? (
            <InlineBanner variant="info">
              AI jest niedostępne — po kliknięciu zobaczysz statyczne przykładowe przepisy z kodu.
            </InlineBanner>
          ) : null}

          {error ? <p className="text-sm text-amber-200">{error}</p> : null}

          {source === "user_disabled" ? (
            <p className="text-sm text-white/60">
              Masz wyłączone funkcje AI w profilu — pokazujemy zestaw przykładowy. Włącz AI, aby
              otrzymywać propozycje dopasowane do Twoich braków.
            </p>
          ) : null}
        </div>
      </section>

      <section className="app-card p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
                Inspiracje
              </p>
              <h2 className="font-heading text-lg font-semibold text-white">
                Propozycje z internetu
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Linki do przepisów dopasowane do Twoich braków. Lista odświeża się automatycznie co kilka godzin.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all" as const, label: "Wszystkie" },
                { id: "high_protein" as const, label: "Białko" },
                { id: "low_calorie" as const, label: "Lekko" },
                { id: "fast" as const, label: "Szybkie" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setInspirationFilter(f.id)}
                  className={
                    inspirationFilter === f.id
                      ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07]"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Input
              value={inspirationQuery}
              onChange={(e) => setInspirationQuery(e.target.value)}
              placeholder="Szukaj w inspiracjach…"
              className="h-10 border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 sm:max-w-[320px]"
            />
          </div>

          {filteredInspirations.length > 0 ? (
            <div className="grid gap-2">
              {filteredInspirations.map((it) => (
                <a
                  key={it.url}
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <p className="text-sm font-semibold text-white/90 group-hover:text-white">
                    {it.title}
                  </p>
                  {it.snippet ? (
                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                      {it.snippet}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-[var(--neon)]/85">
                    Otwórz przepis →
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <InlineBanner variant="info">
              Brak inspiracji z internetu (albo integracja wyszukiwarki nie jest skonfigurowana). Nadal możesz użyć propozycji z aplikacji.
            </InlineBanner>
          )}
        </div>
      </section>

      {meals && meals.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {meals.map((meal, idx) => (
            <article
              key={`${meal.title}-${idx}`}
              className="glass-panel relative flex flex-col overflow-hidden border border-white/[0.08]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element -- zewnętrzny URL ilustracji */}
                <img
                  src={mealIllustrationUrl(meal.title, meal.imagePromptEn)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-heading text-lg font-semibold text-white drop-shadow-md">
                    {meal.title}
                  </h3>
                  {meal.tagline ? (
                    <p className="mt-1 text-sm text-white/80 drop-shadow">{meal.tagline}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      {Math.round(meal.approximateMacros.calories)} kcal
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      B {fmtMacro(meal.approximateMacros.proteinG, "g")}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      T {fmtMacro(meal.approximateMacros.fatG, "g")}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                      W {fmtMacro(meal.approximateMacros.carbsG, "g")}
                    </span>
                  </div>
                  <AddToMealLogSheet
                    dateKey={gaps.dateKey}
                    presetName={meal.title}
                    triggerLabel="Dodaj"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-white/70">
                  {/* spacer */}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Składniki
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-white/80">
                    {meal.ingredients.map((ing) => (
                      <li key={ing}>{ing}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Przepis
                  </p>
                  <ol className="mt-2 list-inside list-decimal space-y-2 text-sm text-white/80">
                    {meal.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
                <p className="mt-auto text-[11px] text-white/40">
                  Makro przybliżone dla jednej porcji. Ilustracja: syntetyczna wizualizacja na podstawie
                  nazwy dania — nie jest zdjęciem realnego przygotowanego posiłku.
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-white/50">
          Kliknij „Wygeneruj propozycje”, aby zobaczyć przepisy i ilustracje.
        </section>
      )}
    </div>
  );
}

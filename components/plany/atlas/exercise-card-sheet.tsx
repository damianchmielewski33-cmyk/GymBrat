"use client";

import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import type { UserExerciseNoteDTO } from "@/actions/user-exercise-notes";
import { PrivateExerciseNote } from "@/components/plany/private-exercise-note";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PlanDayMuscleSummary } from "@/lib/plan-day-muscles";
import type { CatalogExercise } from "@/lib/workout-exercise-catalog";
import { categoryLabel } from "@/lib/workout-exercise-catalog";
import { cn } from "@/lib/utils";

const DIFF_LABEL: Record<string, string> = {
  beginner: "Poziom: początkujący",
  intermediate: "Poziom: średni",
  advanced: "Poziom: zaawansowany",
};

export function ExerciseCardSheet({
  exercise,
  open,
  onOpenChange,
  glyph,
  privateNote,
  onAddToPlan,
}: {
  exercise: CatalogExercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glyph: PlanDayMuscleSummary | null;
  privateNote: UserExerciseNoteDTO | null;
  onAddToPlan?: (ex: CatalogExercise) => void;
}) {
  if (!exercise) return null;
  const steps = (exercise.description ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const cues = exercise.cues ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[22px] border-white/10 pb-28"
      >
        <SheetHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Atlas · {categoryLabel(exercise.categoryId)}
          </p>
          <SheetTitle className="sr-only">{exercise.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex items-start gap-3">
          <MuscleGlyph summary={glyph} size="hero" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-semibold leading-tight text-white">
              {exercise.name}
            </h2>
            {exercise.aliasesEn?.[0] ? (
              <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
                {exercise.aliasesEn[0]}
              </p>
            ) : null}
            <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">
              Główne: {categoryLabel(exercise.categoryId)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(exercise.equipment ?? []).map((eq) => (
            <span
              key={eq}
              className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] text-white"
            >
              {eq}
            </span>
          ))}
          {exercise.difficulty && DIFF_LABEL[exercise.difficulty] ? (
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] text-white">
              {DIFF_LABEL[exercise.difficulty]}
            </span>
          ) : null}
        </div>

        <section className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            <span className="mr-2 text-[var(--gym-gold)]">01</span>
            Jak wykonać
          </h3>
          {steps.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[14px] leading-[21px] text-white/90">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[14px] leading-[21px] text-[var(--gym-text-secondary)]">
              Opis techniki jeszcze nie został dodany. Możesz dodać własną notatkę
              poniżej.
            </p>
          )}
        </section>

        {cues.length > 0 ? (
          <section className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              <span className="mr-2 text-[var(--gym-gold)]">02</span>
              Wskazówki
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[14px] text-white/90">
              {cues.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {exercise.techniqueYoutubeUrl ? (
          <section className="mt-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              Film techniki
            </h3>
            <a
              href={exercise.techniqueYoutubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-2 h-12 w-full gap-2",
              )}
            >
              <Play className="h-4 w-4" aria-hidden />
              Obejrzyj technikę
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <p className="mt-1.5 text-[12px] text-[var(--gym-text-secondary)]">
              Film dodany przez zespół GymBrat. Otwiera się w YouTube w nowej karcie.
            </p>
          </section>
        ) : null}

        <div className="mt-5">
          <PrivateExerciseNote
            exerciseId={exercise.id}
            initial={privateNote}
          />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[rgba(7,7,8,0.96)] px-4 py-3">
          <div className="mx-auto max-w-xl">
            {onAddToPlan ? (
              <Button
                type="button"
                variant="cta"
                className="h-12 w-full"
                onClick={() => onAddToPlan(exercise)}
              >
                Dodaj do planu
              </Button>
            ) : (
              <Link
                href="/plany/nowy"
                className={cn(buttonVariants({ variant: "cta" }), "h-12 w-full")}
              >
                Dodaj do planu
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

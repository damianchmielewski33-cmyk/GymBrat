"use client";

import Link from "next/link";
import { useState } from "react";
import { NotebookPen, Play } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MainCardShell,
  mainCardKickerClass,
  mainCardTitleClass,
} from "@/components/treningi/main-card-shell";
import { formatExerciseCount } from "@/lib/treningi-hub-format";
import { cn } from "@/lib/utils";

const TITLE_ID = "unfinished-workout-title";
const PREVIEW_NAMES = 3;

function exercisePreview(names: readonly string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  const head = clean.slice(0, PREVIEW_NAMES).join(", ");
  return clean.length > PREVIEW_NAMES ? `${head}…` : head;
}

/** Niedokończony trening (4B): kontynuacja albo porzucenie z potwierdzeniem (LR-8, P-5). */
export function UnfinishedWorkoutCard({
  title,
  exerciseNames,
  startedToday,
  onDiscard,
}: {
  title: string;
  exerciseNames: readonly string[];
  startedToday: boolean;
  onDiscard: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = title.trim() || "Trening";
  const preview = exercisePreview(exerciseNames);
  const allNames = exerciseNames.map((n) => n.trim()).filter(Boolean).join(", ");
  const meta = preview
    ? `${formatExerciseCount(exerciseNames.length)} · ${preview}`
    : formatExerciseCount(exerciseNames.length);

  return (
    <MainCardShell accent titleId={TITLE_ID}>
      <p className={mainCardKickerClass}>Niedokończony trening</p>
      <h2 id={TITLE_ID} className={mainCardTitleClass} title={name}>
        {name}
      </h2>
      <p
        className="mt-1.5 truncate text-[13px] tabular-nums text-white/60"
        title={allNames || undefined}
      >
        {meta}
      </p>
      <p className="mt-1.5 text-[13px] text-white/60">
        {startedToday ? "Zaczęty dziś." : "Sesja w toku."} Odhaczone serie są
        zapamiętane.
      </p>

      <Link
        href="/active-workout"
        className={cn(buttonVariants({ variant: "cta" }), "mt-4 w-full gap-2")}
      >
        <Play className="fill-current" aria-hidden />
        Kontynuuj trening
      </Link>

      <div className="mt-1 flex items-center justify-between">
        <Link
          href="/workout-history"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-1 text-[12px] font-semibold text-[var(--gym-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <NotebookPen className="size-3.5" aria-hidden />
          Dziennik obciążeń
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 text-white/70"
          onClick={() => setConfirmOpen(true)}
        >
          Porzuć
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onDiscard}
        title="Porzucić trening?"
        description="Odhaczone serie z tej sesji zostaną usunięte i nie trafią do dziennika. Zapisane wcześniej treningi zostają bez zmian."
        confirmLabel="Porzuć trening"
        cancelLabel="Wróć do treningu"
      />
    </MainCardShell>
  );
}

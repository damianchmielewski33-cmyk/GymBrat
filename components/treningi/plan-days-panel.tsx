"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Download, PencilLine } from "lucide-react";
import type { TreningiHubDay } from "@/lib/treningi-hub-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { PlanDayPreviewSheet } from "@/components/treningi/plan-day-preview-sheet";
import { PlanDayRow } from "@/components/treningi/plan-day-row";
import { printWorkoutPlans } from "@/lib/pdf/workout-plan-export";
import { cn } from "@/lib/utils";

const sectionActionClass =
  "h-11 gap-1 px-2 text-[12px] font-semibold text-[var(--gym-gold)]";

/** Dni planu (US-4): stały numer dnia, jeden podgląd ćwiczeń na panel. */
export function PlanDaysPanel({
  days,
  todayKey,
  nextPlanId,
  startingPlanId,
  onStart,
}: {
  days: readonly TreningiHubDay[];
  todayKey: string;
  nextPlanId: string | null;
  startingPlanId: string | null;
  onStart: (day: TreningiHubDay) => void;
}) {
  const [previewDay, setPreviewDay] = useState<TreningiHubDay | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const startDisabled = startingPlanId != null;

  return (
    <section className="space-y-2.5">
      <SectionLabel
        title="Dni planu"
        titleTone="white"
        titleAs="h2"
        trailing={
          <span className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={sectionActionClass}
              aria-label="Pobierz plan jako PDF"
              onClick={() =>
                printWorkoutPlans(days.map((d) => ({ id: d.row.id, plan: d.row.plan })))
              }
            >
              <Download aria-hidden />
              PDF
            </Button>
            <Link
              href="/profile/workout-plan"
              aria-label="Edytuj plan"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                sectionActionClass,
              )}
            >
              <PencilLine className="size-3.5" aria-hidden />
              Edytuj
            </Link>
          </span>
        }
      />
      <div className="app-panel">
        <ul className="divide-y divide-white/[0.06]" aria-label="Dni planu">
          {days.map((day) => (
            <PlanDayRow
              key={day.row.id}
              day={day}
              todayKey={todayKey}
              isNext={day.row.id === nextPlanId}
              starting={startingPlanId === day.row.id}
              startDisabled={startDisabled}
              onStart={() => onStart(day)}
              onPreview={(el) => {
                returnFocusRef.current = el;
                setPreviewDay(day);
                setPreviewOpen(true);
              }}
            />
          ))}
        </ul>
      </div>
      <PlanDayPreviewSheet
        day={previewDay}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        returnFocusRef={returnFocusRef}
        startDisabled={startDisabled}
        onStart={(day) => {
          setPreviewOpen(false);
          onStart(day);
        }}
      />
    </section>
  );
}

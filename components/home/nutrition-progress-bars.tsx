"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { PieChart, Target } from "lucide-react";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import type { NutritionWeekRollup } from "@/lib/nutrition-goals";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { WeekNutritionSheetBody } from "@/components/home/week-nutrition-sheet-body";

type Props = {
  dayLabel: string;
  dayPercent: number;
  dayDetail: string;
  dayOver: boolean;
  weekLabel: string;
  weekPercent: number;
  weekDetail: string;
  weekOver: boolean;
  /** Jeśli podane — przycisk „Ten tydzień” otwiera szczegóły dni. */
  weekDayRows?: WeekDayNutritionRow[];
  /** Klucz dzisiejszej daty (YYYY-MM-DD) — do podziału dni w arkuszu. */
  sheetTodayKey?: string;
  /** Sumy tygodnia do karty „ile zostało” makroskładników. */
  weekNutritionRollup?: Pick<
    NutritionWeekRollup,
    | "sumProteinGoal"
    | "sumProteinConsumed"
    | "sumFatGoal"
    | "sumFatConsumed"
    | "sumCarbsGoal"
    | "sumCarbsConsumed"
    | "sumCaloriesGoal"
    | "sumCaloriesConsumed"
  >;
  previousWeeks?: PreviousWeekNutritionSheetWeek[];
};

function BarBlock({
  title,
  icon,
  percent,
  detail,
  isOver,
  bottomAction,
}: {
  title: string;
  icon: ReactNode;
  percent: number;
  detail: string;
  isOver: boolean;
  bottomAction?: ReactNode;
}) {
  const width = Math.min(100, Math.max(0, percent));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            {title}
          </p>
          <p className="font-heading mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            <span className={isOver ? "text-rose-300" : "text-white"}>
              {percent.toFixed(1)}%
            </span>
            <span className="mt-0.5 block text-sm font-normal leading-snug text-white/45 sm:ml-1 sm:mt-0 sm:inline sm:text-base">
              realizacji celu kalorycznego
            </span>
          </p>
          <p className="mt-2 break-words text-xs text-white/55">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 sm:h-11 sm:w-11">
          {icon}
        </div>
      </div>
      <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${
            isOver
              ? "bg-gradient-to-r from-rose-400 to-rose-600"
              : "bg-gradient-to-r from-[#ff4d6d] via-[#ff2d55] to-[#ff7aa1]"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.85, ease: "easeOut" }}
        />
      </div>
      {bottomAction ? <div className="mt-4">{bottomAction}</div> : null}
    </div>
  );
}

export function NutritionProgressBars({
  dayLabel,
  dayPercent,
  dayDetail,
  dayOver,
  weekLabel,
  weekPercent,
  weekDetail,
  weekOver,
  weekDayRows,
  sheetTodayKey,
  weekNutritionRollup,
  previousWeeks,
}: Props) {
  const weekBlock = (
    <BarBlock
      title={weekLabel}
      icon={<Target className="h-5 w-5 text-[var(--neon)]" />}
      percent={weekPercent}
      detail={weekDetail}
      isOver={weekOver}
      bottomAction={
        weekDayRows?.length ? (
          <SheetTrigger className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--neon)]/50">
            Ten tydzień
          </SheetTrigger>
        ) : undefined
      }
    />
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BarBlock
        title={dayLabel}
        icon={<PieChart className="h-5 w-5 text-[var(--neon)]" />}
        percent={dayPercent}
        detail={dayDetail}
        isOver={dayOver}
      />
      {weekDayRows?.length ? (
        <Sheet>
          {weekBlock}
          <SheetContent
            side="bottom"
            className="max-h-[90vh] border-white/10 bg-[#0a0a0f] pb-[env(safe-area-inset-bottom)] text-white"
          >
            <SheetHeader>
              <SheetTitle className="text-white">Ten tydzień — szczegóły</SheetTitle>
              <SheetDescription className="text-white/55">
                Kalorie i makroskładniki z Twoich wpisów posiłków oraz odchylenie od celu —
                każdy dzień (pon.–niedz.).
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <WeekNutritionSheetBody
                rows={weekDayRows}
                todayKey={sheetTodayKey}
                weekRollup={weekNutritionRollup}
                previousWeeks={previousWeeks}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        weekBlock
      )}
    </div>
  );
}

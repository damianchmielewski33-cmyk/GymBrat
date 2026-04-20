"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVolumeKg } from "@/lib/workout-session-calculations";
import { cn } from "@/lib/utils";

type WorkoutSummaryProps = {
  sessionTotal: number;
  canComplete: boolean;
  saving: boolean;
  onComplete: () => void;
  saveError?: string | null;
  className?: string;
};

/**
 * Dolny pasek jak w mobilnych dziennikach: objętość + jeden główny przycisk.
 */
export function WorkoutSummary({
  sessionTotal,
  canComplete,
  saving,
  onComplete,
  saveError,
  className,
}: WorkoutSummaryProps) {
  return (
    <motion.div
      initial={false}
      className={cn(
        "pointer-events-auto fixed inset-x-0 bottom-0 z-[1000] border-t border-white/[0.08] bg-[#121212]/95 backdrop-blur-xl",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            Sesja — objętość
          </p>
          <p className="font-heading text-2xl font-bold tabular-nums tracking-tight text-white sm:text-[1.75rem]">
            {formatVolumeKg(sessionTotal)}{" "}
            <span className="text-base font-semibold text-white/45">kg</span>
          </p>
          {saveError ? <p className="mt-1 text-xs text-red-400">{saveError}</p> : null}
        </div>

        <motion.div
          className="w-full shrink-0 sm:w-auto sm:max-w-[280px]"
          whileHover={canComplete && !saving ? { scale: 1.01 } : undefined}
          whileTap={canComplete && !saving ? { scale: 0.99 } : undefined}
        >
          <Button
            type="button"
            onClick={onComplete}
            disabled={saving || !canComplete}
            className="h-[52px] w-full rounded-2xl bg-[#FF1A4B] text-[15px] font-semibold text-white shadow-sm hover:bg-[#e61645] disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Zapisywanie…
              </>
            ) : (
              <>
                <Check className="mr-2 h-5 w-5" />
                Zakończ trening
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

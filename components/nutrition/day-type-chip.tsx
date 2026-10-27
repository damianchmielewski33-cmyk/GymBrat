import { Dumbbell, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NutritionDayType } from "@/lib/nutrition-goals";

export function DayTypeChip({
  dayType,
  className,
}: {
  dayType: NutritionDayType | "unknown";
  className?: string;
}) {
  if (dayType === "unknown") return null;
  const training = dayType === "training";
  const Icon = training ? Dumbbell : Moon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--gym-border-gold)] bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white/90",
        className,
      )}
    >
      <Icon className="h-3 w-3 text-[var(--gym-gold)]" aria-hidden />
      {training ? "Trening" : "Odpoczynek"}
    </span>
  );
}

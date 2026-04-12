import { cn } from "@/lib/utils";

/**
 * Premium glassmorphism surface for workout UI (Fitbod / Hevy style).
 * Spec: rgba fill, hairline border, backdrop blur ~12px, neon shadow.
 */
export const workoutGlassCardClass =
  "rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] shadow-[0_0_20px_rgba(255,0,50,0.3)] backdrop-blur-[12px]";

type WorkoutGlassCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function WorkoutGlassCard({ children, className }: WorkoutGlassCardProps) {
  return (
    <div className={cn(workoutGlassCardClass, "relative overflow-hidden", className)}>
      {/* Subtle inner highlight — keeps depth without changing behavior */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 42%), radial-gradient(800px 400px at 10% 0%, rgba(255,26,75,0.12), transparent 55%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Generic alias — use when importing a neutral “glass card” name. */
export { WorkoutGlassCard as GlassCard };

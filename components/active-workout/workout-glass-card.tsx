import { cn } from "@/lib/utils";

type WorkoutGlassCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function WorkoutGlassCard({ children, className }: WorkoutGlassCardProps) {
  return (
    <div className={cn("glass-panel relative overflow-hidden", className)}>
      <div className="relative">{children}</div>
    </div>
  );
}

export const workoutGlassCardClass = "glass-panel";

/** Generic alias — use when importing a neutral “glass card” name. */
export { WorkoutGlassCard as GlassCard };

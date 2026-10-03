import { cn } from "@/lib/utils";

type SectionLabelProps = {
  index?: string | number;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
};

export function SectionLabel({
  index,
  title,
  trailing,
  className,
}: SectionLabelProps) {
  const indexText =
    typeof index === "number" ? String(index).padStart(2, "0") : index;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        {indexText ? (
          <span className="font-metric text-[15px] leading-none text-[var(--gym-gold)]">
            {indexText}
          </span>
        ) : null}
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {title}
        </span>
      </div>
      <div className="h-px min-w-[1.5rem] flex-1 bg-[var(--gym-gold)]/35" />
      {trailing != null ? (
        <div className="shrink-0 text-[11px] text-white/45">{trailing}</div>
      ) : null}
    </div>
  );
}

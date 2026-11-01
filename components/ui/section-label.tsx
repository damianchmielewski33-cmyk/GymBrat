import { cn } from "@/lib/utils";

type SectionLabelProps = {
  index?: string | number;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
  /** Domyślnie złoty jak na DZIŚ; Postępy używają białego tytułu. */
  titleTone?: "gold" | "white";
  /** Element tytułu; `h2`, gdy sekcja jest nagłówkiem w strukturze strony. */
  titleAs?: "span" | "h2";
};

export function SectionLabel({
  index,
  title,
  trailing,
  className,
  titleTone = "gold",
  titleAs: TitleTag = "span",
}: SectionLabelProps) {
  const indexText =
    typeof index === "number" ? String(index).padStart(2, "0") : index;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        {indexText ? (
          <span className="font-heading text-[length:var(--text-body-lg)] font-semibold leading-none tabular-nums text-[var(--gym-gold)]">
            {indexText}
          </span>
        ) : null}
        <TitleTag
          className={cn(
            "text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.14em]",
            titleTone === "white" ? "text-white/85" : "text-[var(--gym-gold)]",
          )}
        >
          {title}
        </TitleTag>
      </div>
      <div className="h-px min-w-[1.5rem] flex-1 bg-[var(--gym-gold)]/35" />
      {trailing != null ? (
        <div className="shrink-0 text-[length:var(--text-label)] text-white/55">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

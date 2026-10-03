import { SectionLabel } from "@/components/ui/section-label";

function formatShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

export function HomeOdDamiana({
  text,
  dateKey,
}: {
  text: string | null;
  dateKey: string | null;
}) {
  if (!text?.trim()) return null;

  return (
    <section className="space-y-3">
      <SectionLabel index={3} title="Od Damiana" />
      <div className="flex gap-3 px-0.5">
        <div className="flex flex-col items-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gym-gold)] font-semibold text-black">
            D
          </span>
          <span className="mt-1 w-px flex-1 min-h-[2rem] bg-[var(--gym-gold)]/45" />
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">
            {text.trim()}
          </p>
          <p className="mt-3 text-[12px] text-white/40">
            Damian{dateKey ? ` · ${formatShort(dateKey)}` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

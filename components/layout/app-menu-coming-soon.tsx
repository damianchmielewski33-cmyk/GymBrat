import { BackLink } from "@/components/ui/back-link";

/** Lekki placeholder pod funkcje z makiety menu (pakiet, kody, badania). */
export function AppMenuComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-8">
      <BackLink href="/" label="Wróć" />
      <header className="space-y-1.5 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]/80">
          Wkrótce
        </p>
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-white">
          {title}
        </h1>
        <p className="text-[14px] leading-relaxed text-white/55">{description}</p>
      </header>
    </div>
  );
}

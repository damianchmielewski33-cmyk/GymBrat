import Link from "next/link";
import type { ReactNode } from "react";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { PRIVACY_PATH, REGULAMIN_PATH } from "@/lib/legal-seller";
import { cn } from "@/lib/utils";

export function LegalDocShell({
  title,
  updated,
  incomplete,
  children,
}: {
  title: string;
  updated: string;
  incomplete?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-6">
      <AuthHeroBrand
        headline={title}
        support={`Ostatnia aktualizacja: ${updated}`}
        compact
      />

      {incomplete ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100/95"
        >
          Uzupełnij dane sprzedawcy w zmiennych środowiskowych (
          <code className="text-[12px]">LEGAL_SELLER_*</code>,{" "}
          <code className="text-[12px]">LEGAL_CONTACT_*</code>
          ), żeby Regulamin i Polityka prywatności zawierały kompletne dane
          firmy.
        </p>
      ) : null}

      <nav
        aria-label="Dokumenty prawne"
        className="flex flex-wrap gap-2 text-[length:var(--text-body-sm)]"
      >
        <Link
          href={REGULAMIN_PATH}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-3.5",
            "border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 font-semibold text-[var(--gym-gold)]",
          )}
        >
          Regulamin
        </Link>
        <Link
          href={PRIVACY_PATH}
          className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3.5 font-semibold text-white/70 hover:border-white/25 hover:text-white"
        >
          Polityka prywatności
        </Link>
        <Link
          href="/package"
          className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3.5 font-semibold text-white/70 hover:border-white/25 hover:text-white"
        >
          Pakiety
        </Link>
      </nav>

      <article className="app-card space-y-6 border border-white/[0.08] bg-[var(--gym-surface-sunken)] px-5 py-6 text-[length:var(--text-body)] leading-relaxed text-white/80 sm:px-7 sm:py-8">
        {children}
      </article>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-heading text-[length:var(--text-body-lg)] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

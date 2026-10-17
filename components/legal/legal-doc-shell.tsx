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
          ), żeby były zgodne z kontem HotPay — inaczej weryfikacja sklepu może
          zostać odrzucona.
        </p>
      ) : null}

      <nav
        aria-label="Dokumenty prawne"
        className="flex flex-wrap gap-2 text-[13px]"
      >
        <Link
          href={REGULAMIN_PATH}
          className={cn(
            "rounded-full border px-3 py-1.5",
            "border-[#DDBB6D]/35 bg-[#DDBB6D]/10 text-[#DDBB6D]",
          )}
        >
          Regulamin
        </Link>
        <Link
          href={PRIVACY_PATH}
          className="rounded-full border border-white/15 px-3 py-1.5 text-white/70 hover:border-white/25 hover:text-white"
        >
          Polityka prywatności
        </Link>
        <Link
          href="/package"
          className="rounded-full border border-white/15 px-3 py-1.5 text-white/70 hover:border-white/25 hover:text-white"
        >
          Pakiety
        </Link>
      </nav>

      <article className="space-y-6 rounded-[24px] border border-white/[0.08] bg-[#0A0A0A] px-5 py-6 text-[14px] leading-relaxed text-white/75 sm:px-7 sm:py-8">
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
      <h2 className="text-[15px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

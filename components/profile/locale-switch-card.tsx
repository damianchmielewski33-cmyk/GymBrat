"use client";

import { useI18n, type AppLocale } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LocaleSwitchCard() {
  const { locale, setLocale } = useI18n();

  function cycle() {
    const next: AppLocale = locale === "pl" ? "en" : "pl";
    setLocale(next);
  }

  return (
    <section className="glass-panel relative overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(600px_240px_at_90%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05]">
            <Languages className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Język interfejsu
            </p>
            <p className="font-heading mt-1 text-base font-semibold text-white">
              {locale === "pl" ? "Polski" : "English"}
            </p>
            <p className="mt-1 text-sm text-white/55">
              Dotyczy nawigacji i elementów oznaczonych w słowniku — pełne tłumaczenie całej aplikacji
              rozszerzamy stopniowo.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 border-white/15 bg-white/[0.04]"
          onClick={() => cycle()}
        >
          {locale === "pl" ? "Switch to English" : "Przełącz na polski"}
        </Button>
      </div>
    </section>
  );
}

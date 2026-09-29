"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function MealCatalogEmptyState({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();

  return (
    <section className="app-card flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <UtensilsCrossed className="h-7 w-7 text-[var(--gym-gold)]" strokeWidth={1.75} />
      </div>
      <div className="max-w-md space-y-2">
        <p className="app-label">{t("diet.catalogLabel")}</p>
        <h2 className="text-lg font-semibold text-white">{t("diet.catalogEmptyTitle")}</h2>
        <p className="text-sm text-white/55">
          {isAdmin ? t("diet.catalogEmptyAdmin") : t("diet.catalogEmptyUser")}
        </p>
      </div>
      {isAdmin ? (
        <Link
          href="/admin/catalog"
          className={cn(buttonVariants({ variant: "default" }), "mt-1")}
        >
          {t("diet.openAdminCatalog")}
        </Link>
      ) : null}
    </section>
  );
}

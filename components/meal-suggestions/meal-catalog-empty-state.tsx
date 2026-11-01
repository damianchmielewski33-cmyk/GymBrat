"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { useI18n } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function MealCatalogEmptyState({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();

  return (
    <AppEmptyState
      icon={
        <UtensilsCrossed className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      }
      title={t("diet.catalogEmptyTitle")}
      description={
        isAdmin ? t("diet.catalogEmptyAdmin") : t("diet.catalogEmptyUser")
      }
      action={
        isAdmin ? (
          <Link
            href="/admin/catalog"
            className={cn(buttonVariants({ variant: "default" }), "w-full")}
          >
            {t("diet.openAdminCatalog")}
          </Link>
        ) : null
      }
    />
  );
}

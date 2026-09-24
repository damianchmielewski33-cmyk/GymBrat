"use client";

import { Download, Smartphone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useInstalledAndroidAppIdentity } from "@/hooks/use-android-app-identity";
import { cn } from "@/lib/utils";

/**
 * Widoczna w przeglądarce / PWA — link do APK GymBrat.
 * W zainstalowanym WebView kartę aktualizacji pokazuje AndroidAppVersionCard.
 */
export function AndroidAppDownloadCard() {
  const installed = useInstalledAndroidAppIdentity();
  if (installed) return null;

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(720px_300px_at_85%_0%,rgba(212,175,55,0.14),transparent_58%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Telefon
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">Aplikacja Android</h2>
            <p className="mt-2 text-sm text-white/60">
              Zainstaluj GymBrat na telefonie — pełny ekran WebView z tą samą stroną i kontem.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Smartphone className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          </div>
        </div>

        <a
          href="/api/android/download?source=profile"
          className={cn(buttonVariants({ variant: "default" }), "rounded-full")}
        >
          <Download className="h-4 w-4" />
          Pobierz APK
        </a>
      </div>
    </section>
  );
}

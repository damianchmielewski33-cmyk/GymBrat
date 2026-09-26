"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstalledAndroidAppIdentity } from "@/hooks/use-android-app-identity";
import { compareAndroidAppVersion, requestNativeAndroidUpdate } from "@/lib/app-webview";
import { cn } from "@/lib/utils";

type LatestInfo = {
  versionCode: number;
  versionName: string;
  notes?: string | null;
};

export function AndroidAppVersionCard() {
  const installed = useInstalledAndroidAppIdentity();
  const [latest, setLatest] = useState<LatestInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!installed) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/android/version", { cache: "no-store" });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Nie udało się pobrać informacji o wersji");
      }
      const body = (await res.json().catch(() => ({}))) as LatestInfo & { error?: string };
      if (!res.ok || typeof body.versionCode !== "number" || typeof body.versionName !== "string") {
        throw new Error(body.error ?? "Nie udało się pobrać informacji o wersji");
      }
      setLatest({ versionCode: body.versionCode, versionName: body.versionName, notes: body.notes });
    } catch (e) {
      setLatest(null);
      setError(e instanceof Error ? e.message : "Nie udało się sprawdzić aktualizacji");
    } finally {
      setChecking(false);
    }
  }, [installed]);

  useEffect(() => {
    if (!installed) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [installed, load]);

  if (!installed) return null;

  const updateAvailable = latest ? compareAndroidAppVersion(installed, latest) > 0 : false;

  function startUpdate() {
    if (!requestNativeAndroidUpdate()) {
      window.location.href = "/api/android/download?source=profile";
    }
  }

  async function checkAgain() {
    await load();
    // W APK: natywny Toast + ewentualne pobranie, gdy serwer ma nowszy versionCode.
    requestNativeAndroidUpdate();
  }

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(720px_300px_at_85%_0%,rgba(255,45,85,0.14),transparent_58%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Telefon
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">Aplikacja Android</h2>
            <p className="mt-2 text-sm text-white/60">
              Wersja zainstalowana na tym telefonie i informacja, czy jest nowsza aktualizacja.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
            <Smartphone className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">
              Zainstalowana
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-white">
              {installed.versionName}
            </dd>
            {installed.versionCode != null ? (
              <dd className="mt-0.5 text-xs text-white/45">Kompilacja {installed.versionCode}</dd>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-white/45">
              Aktualizacja
            </dt>
            <dd
              className={cn(
                "mt-1 text-sm font-semibold",
                error ? "text-rose-300" : updateAvailable ? "text-[var(--gym-gold-bright)]" : "text-white",
              )}
            >
              {checking && !latest && !error
                ? "Sprawdzanie…"
                : error
                  ? error
                  : updateAvailable
                    ? `Dostępna nowa wersja ${latest?.versionName}`
                    : latest
                      ? "Masz najnowszą wersję. Aktualizacji nie ma."
                      : "Sprawdzanie…"}
            </dd>
            {updateAvailable && latest?.notes ? (
              <dd className="mt-1 text-xs text-white/50">{latest.notes}</dd>
            ) : null}
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {updateAvailable ? (
            <Button type="button" className="rounded-full" onClick={startUpdate}>
              <Download className="h-4 w-4" />
              Zainstaluj {latest?.versionName}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={checking}
            className="rounded-full"
            onClick={() => void checkAgain()}
          >
            <RefreshCw className="h-4 w-4" />
            {checking ? "Sprawdzanie…" : "Sprawdź ponownie"}
          </Button>
        </div>
      </div>
    </section>
  );
}

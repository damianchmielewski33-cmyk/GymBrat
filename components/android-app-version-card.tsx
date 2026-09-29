"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstalledAndroidAppIdentity } from "@/hooks/use-android-app-identity";
import { compareAndroidAppVersion, requestNativeAndroidUpdate } from "@/lib/app-webview";
import { cn } from "@/lib/utils";

const PROFILE_WEB_DOWNLOAD_HREF = "/api/android/download?source=profile-web";

type LatestInfo = {
  versionCode: number;
  versionName: string;
  apkUrl?: string | null;
  notes?: string | null;
};

export function AndroidAppVersionCard() {
  const installed = useInstalledAndroidAppIdentity();
  const [hydrated, setHydrated] = useState(false);
  const [latest, setLatest] = useState<LatestInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const loadLatest = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/android/version", { cache: "no-store" });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Nie udało się pobrać informacji o wersji");
      }
      const body = (await res.json().catch(() => ({}))) as LatestInfo & {
        error?: string;
      };
      if (
        !res.ok ||
        typeof body.versionCode !== "number" ||
        typeof body.versionName !== "string"
      ) {
        throw new Error(body.error ?? "Nie udało się pobrać informacji o wersji");
      }
      setLatest({
        versionCode: body.versionCode,
        versionName: body.versionName,
        apkUrl: typeof body.apkUrl === "string" ? body.apkUrl : null,
        notes: body.notes,
      });
    } catch (e) {
      setLatest(null);
      setError(
        e instanceof Error ? e.message : "Nie udało się sprawdzić aktualizacji",
      );
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void loadLatest();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, loadLatest]);

  // SSR / pierwszy render — nic, żeby uniknąć flashu złej karty w APK.
  if (!hydrated) return null;

  // Przeglądarka / PWA: bezpośredni link do najnowszego APK.
  if (!installed) {
    const downloadHref =
      latest?.apkUrl && latest.apkUrl.startsWith("http")
        ? latest.apkUrl
        : PROFILE_WEB_DOWNLOAD_HREF;

    return (
      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="app-label text-[var(--gym-gold)]">Telefon</p>
            <h2 className="mt-1.5 text-lg font-semibold text-white">
              Aplikacja Android
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/45">
              Dla użytkowników przeglądarki — bezpośredni link do najnowszego
              instalatora GymBrat (APK).
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
            <Smartphone className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <a
            href={downloadHref}
            download={downloadHref.includes(".apk") ? "gymbrat.apk" : undefined}
            rel="noopener noreferrer"
            className="gym-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold sm:w-auto"
          >
            <Download className="h-4 w-4" aria-hidden />
            {latest
              ? `Pobierz Android ${latest.versionName}`
              : checking
                ? "Sprawdzanie wersji…"
                : "Pobierz aplikację Android"}
          </a>

          <p className="break-all text-xs leading-relaxed text-white/40">
            Link:{" "}
            <a
              href={downloadHref}
              className="inline-flex items-center gap-1 text-[var(--gym-gold)] underline-offset-2 hover:underline"
              rel="noopener noreferrer"
            >
              {downloadHref}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          </p>

          {latest ? (
            <p className="text-xs text-white/45">
              Najnowsza kompilacja {latest.versionCode}
              {latest.notes ? ` · ${latest.notes}` : null}
            </p>
          ) : error ? (
            <p className="text-xs text-rose-300/90">{error}</p>
          ) : null}

          <p className="text-xs text-white/35">
            Po pobraniu zezwól na instalację z tego źródła. Aktualizacja nad
            starą wersją wymaga tego samego podpisu APK.
          </p>
        </div>
      </section>
    );
  }

  const updateAvailable = latest
    ? compareAndroidAppVersion(installed, latest) > 0
    : false;

  function startUpdate() {
    if (!requestNativeAndroidUpdate()) {
      window.location.href = "/api/android/download?source=profile";
    }
  }

  async function checkAgain() {
    await loadLatest();
    requestNativeAndroidUpdate();
  }

  return (
    <section className="app-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="app-label text-[var(--gym-gold)]">Telefon</p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            Aplikacja Android
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/45">
            Wersja zainstalowana na tym telefonie i informacja, czy jest nowsza
            aktualizacja.
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
          <Smartphone className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="app-card-raised p-4">
          <dt className="app-label">Zainstalowana</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-white">
            {installed.versionName}
          </dd>
          {installed.versionCode != null ? (
            <dd className="mt-0.5 text-xs text-white/45">
              Kompilacja {installed.versionCode}
            </dd>
          ) : null}
        </div>
        <div className="app-card-raised p-4">
          <dt className="app-label">Aktualizacja</dt>
          <dd
            className={cn(
              "mt-1 text-sm font-semibold",
              error
                ? "text-rose-300"
                : updateAvailable
                  ? "text-[var(--gym-gold-bright)]"
                  : "text-white",
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

      <div className="mt-5 flex flex-wrap gap-2">
        {updateAvailable ? (
          <Button
            type="button"
            className="gym-btn-primary h-11 rounded-2xl"
            onClick={startUpdate}
          >
            <Download className="h-4 w-4" />
            Zainstaluj {latest?.versionName}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={checking}
          className="h-11 rounded-2xl border-white/15"
          onClick={() => void checkAgain()}
        >
          <RefreshCw className="h-4 w-4" />
          {checking ? "Sprawdzanie…" : "Sprawdź ponownie"}
        </Button>
      </div>
    </section>
  );
}

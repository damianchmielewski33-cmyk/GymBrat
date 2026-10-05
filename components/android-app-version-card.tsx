"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApkDownloadButton } from "@/components/apk-download-button";
import { useInstalledAndroidAppIdentity } from "@/hooks/use-android-app-identity";
import {
  compareAndroidAppVersion,
  isAndroidPhoneBrowserClient,
  requestNativeAndroidUpdate,
} from "@/lib/app-webview";
import { cn } from "@/lib/utils";

type LatestInfo = {
  versionCode: number;
  versionName: string;
  apkUrl?: string | null;
  notes?: string | null;
};

/** RWD telefon — spójne z typowym breakpointem sm (640px) / layoutem mobilnym. */
const PHONE_RWD_MQ = "(max-width: 767px)";

function useAndroidPhoneRwd(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!isAndroidPhoneBrowserClient()) {
      setOk(false);
      return;
    }
    const mq = window.matchMedia(PHONE_RWD_MQ);
    const sync = () => setOk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return ok;
}

export function AndroidAppVersionCard() {
  const installed = useInstalledAndroidAppIdentity();
  const androidPhoneRwd = useAndroidPhoneRwd();
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

  const shouldShow =
    hydrated && (Boolean(installed) || androidPhoneRwd);

  useEffect(() => {
    if (!shouldShow) return;
    const timer = window.setTimeout(() => {
      void loadLatest();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [shouldShow, loadLatest]);

  if (!hydrated) return null;

  /** Pobieranie APK — tylko telefon Android w widoku RWD (nie PC, nie iPhone). */
  if (!installed) {
    if (!androidPhoneRwd) return null;

    return (
      <section className="app-card p-5 sm:p-6 md:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="app-label text-[var(--gym-gold)]">Telefon</p>
            <h2 className="mt-1.5 text-lg font-semibold text-white">
              Aplikacja Android
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/45">
              Pobieranie omija menedżer Chrome (ten często „wisi” na 100%). Po
              pobraniu wybierz „Zapisz w plikach” albo instalator.
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
            <Smartphone className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {latest ? (
            <ApkDownloadButton
              versionName={latest.versionName}
              versionCode={latest.versionCode}
            />
          ) : (
            <p className="text-sm text-white/50">
              {checking ? "Sprawdzanie wersji…" : "Ładowanie informacji o APK…"}
            </p>
          )}

          {latest ? (
            <p className="text-xs text-white/45">
              Najnowsza kompilacja {latest.versionCode}
              {latest.notes ? ` · ${latest.notes}` : null}
            </p>
          ) : error ? (
            <p className="text-xs text-rose-300/90">{error}</p>
          ) : null}

          <p className="text-xs text-white/35">
            Po zapisaniu zezwól na instalację z tego źródła. Jeśli masz starą
            GymBrat z innym podpisem — najpierw ją odinstaluj.
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
      window.location.href = `/gymbrat-${latest?.versionName ?? "download"}.apk?v=${latest?.versionCode ?? 0}`;
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
        {updateAvailable && latest ? (
          <>
            <Button
              type="button"
              className="gym-btn-primary h-11 rounded-2xl"
              onClick={startUpdate}
            >
              Zainstaluj {latest.versionName}
            </Button>
            <ApkDownloadButton
              versionName={latest.versionName}
              versionCode={latest.versionCode}
              label={`Pobierz plik ${latest.versionName}`}
              className="h-11"
            />
          </>
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

      {!updateAvailable && latest ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-white/45">
            Potrzebujesz świeżego pliku instalacyjnego (np. po odinstalowaniu)?
          </p>
          <ApkDownloadButton
            versionName={latest.versionName}
            versionCode={latest.versionCode}
            label={`Pobierz APK ${latest.versionName}`}
          />
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-white/35">
        Link awaryjny:{" "}
        <a
          href={
            latest
              ? `/gymbrat-${latest.versionName}.apk?v=${latest.versionCode}`
              : "/api/android/download?source=profile"
          }
          className="inline-flex items-center gap-1 text-white/55 underline-offset-2 hover:underline"
        >
          bezpośredni APK
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>
    </section>
  );
}

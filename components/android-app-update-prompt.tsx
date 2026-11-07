"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Download } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import { useInstalledAndroidAppIdentity } from "@/hooks/use-android-app-identity";
import {
  androidUpdateLaterStorageKey,
  requestNativeAndroidUpdate,
  shouldShowAndroidUpdatePrompt,
  type AndroidLatestVersion,
} from "@/lib/app-webview";

type LatestInfo = AndroidLatestVersion & { notes?: string | null };

function readPostponedVersionCode(versionCode: number | undefined): number | null {
  if (versionCode == null || typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(androidUpdateLaterStorageKey(versionCode)) === "1"
      ? versionCode
      : null;
  } catch {
    return null;
  }
}

/**
 * Blokujący popup w WebView zainstalowanego APK, gdy na serwerze jest nowsza wersja.
 * Zwykła przeglądarka i PWA go nie widzą.
 */
export function AndroidAppUpdatePrompt() {
  const { status } = useSession();
  const installed = useInstalledAndroidAppIdentity();
  const [latest, setLatest] = useState<LatestInfo | null>(null);
  const [postponedVersionCode, setPostponedVersionCode] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!installed) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/android/version", { cache: "no-store" });
          const contentType = res.headers.get("content-type") ?? "";
          if (!res.ok || !contentType.includes("application/json")) {
            if (!cancelled) setLatest(null);
            return;
          }
          const body = (await res.json().catch(() => ({}))) as LatestInfo;
          if (typeof body.versionCode !== "number" || typeof body.versionName !== "string") {
            if (!cancelled) setLatest(null);
            return;
          }
          const next = {
            versionCode: body.versionCode,
            versionName: body.versionName,
            notes: body.notes,
          };
          if (cancelled) return;
          setLatest(next);
          setPostponedVersionCode(readPostponedVersionCode(next.versionCode));
        } catch {
          if (!cancelled) setLatest(null);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [installed]);

  const open = shouldShowAndroidUpdatePrompt({
    inInstalledApp: Boolean(installed),
    current: installed,
    latest,
    postponedVersionCode,
    signedIn: status === "authenticated",
  });

  function postpone() {
    if (!latest) return;
    try {
      sessionStorage.setItem(androidUpdateLaterStorageKey(latest.versionCode), "1");
    } catch {
      /* private mode */
    }
    setPostponedVersionCode(latest.versionCode);
  }

  function startUpdate() {
    setStarting(true);
    if (!requestNativeAndroidUpdate()) {
      window.location.href = "/api/android/download?source=in-app-update";
    }
  }

  return (
    <AppDialog
      open={open}
      onOpenChange={() => {}}
      tone="gold"
      icon={Download}
      title="Wymagana aktualizacja"
      description={`Nowa wersja ${latest?.versionName ?? ""} jest już dostępna. Masz zainstalowaną wersję ${
        installed?.versionName ?? "nieznaną"
      }. Zainstaluj aktualizację, żeby GymBrat działał bez błędów.`}
    >
      {latest?.notes ? <p className="mt-3 text-sm text-white/55">{latest.notes}</p> : null}
      {starting ? (
        <p className="mt-3 text-sm font-medium text-white/80">
          Pobieranie w tle — zaraz otworzy się instalator. Jeśli nic się nie dzieje, zezwól na instalację
          z tej aplikacji w ustawieniach telefonu.
        </p>
      ) : null}
      <AppDialogActions>
        <AppDialogButton intent="primary" onClick={startUpdate} disabled={starting}>
          {starting ? "Uruchamianie…" : `Aktualizuj do ${latest?.versionName ?? ""}`}
        </AppDialogButton>
        <AppDialogButton onClick={postpone} disabled={starting}>
          Później
        </AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import type { AdPlacement } from "@/lib/admob-gate";
import { isInstalledAndroidAppClient } from "@/lib/app-webview";

type GateState = "checking" | "skip" | "show";

/**
 * Pełnoekranowa bramka reklamowa dla użytkowników bez pakietu.
 * Na Android APK woła GymBratAndroid.showInterstitialAd; w przeglądarce —
 * ekran z CTA do pakietu (AdMob web unit opcjonalnie przez NEXT_PUBLIC_ADMOB_*).
 */
export function useFullscreenAdGate(placement: AdPlacement) {
  const [state, setState] = useState<GateState>("checking");
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/package/status", { credentials: "include" });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        showAds?: boolean;
      } | null;
      if (res.ok && data?.ok && data.showAds) {
        setState("show");
        return true;
      }
      setState("skip");
      return false;
    } catch {
      setState("skip");
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runWithAd = useCallback(
    async (action: () => void | Promise<void>) => {
      const needsAd = state === "show" || (await refresh());
      if (!needsAd) {
        await action();
        return;
      }

      const android = window.GymBratAndroid;
      if (
        isInstalledAndroidAppClient() &&
        android &&
        typeof android.showInterstitialAd === "function"
      ) {
        window.__gymbratOnInterstitial = (ok) => {
          window.__gymbratOnInterstitial = undefined;
          void action();
          if (!ok) {
            /* natywny błąd — i tak kontynuujemy akcję */
          }
        };
        try {
          android.showInterstitialAd(placement);
          return;
        } catch {
          window.__gymbratOnInterstitial = undefined;
        }
      }

      setOpen(true);
      // Po zamknięciu UI wywołamy action z continueAfterAd
      (window as unknown as { __gymbratPendingAdAction?: () => void }).__gymbratPendingAdAction =
        () => {
          void action();
        };
    },
    [placement, refresh, state],
  );

  function continueAfterAd() {
    setOpen(false);
    const pending = (window as unknown as { __gymbratPendingAdAction?: () => void })
      .__gymbratPendingAdAction;
    (window as unknown as { __gymbratPendingAdAction?: () => void }).__gymbratPendingAdAction =
      undefined;
    pending?.();
  }

  return { state, open, runWithAd, continueAfterAd, setOpen };
}

export function FullscreenAdOverlay({
  open,
  onContinue,
  placement,
}: {
  open: boolean;
  onContinue: () => void;
  placement: AdPlacement;
}) {
  const [mounted, setMounted] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setCanSkip(false);
      return;
    }
    setCanSkip(false);
    const t = window.setTimeout(() => setCanSkip(true), 2500);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted || !open) return null;

  const unitId = process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID?.trim();

  return createPortal(
    <div className="fixed inset-0 z-[1400] flex flex-col bg-black text-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
          Reklama · {placement}
        </p>
        <div className="flex min-h-[220px] w-full max-w-sm flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          {unitId ? (
            <p className="text-sm text-white/55">
              Jednostka AdMob: <span className="font-mono text-xs">{unitId}</span>
              <br />
              (pełne kreacje w APK przez natywny SDK)
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-white/55">
              Tu pojawi się reklama AdMob. Ustaw{" "}
              <span className="font-mono text-xs">NEXT_PUBLIC_ADMOB_*</span> oraz
              ID w APK, albo kup pakiet bez reklam.
            </p>
          )}
        </div>
        <Link
          href="/package"
          className="text-sm font-semibold text-[var(--gym-gold)] underline-offset-2 hover:underline"
        >
          Kup pakiet — bez reklam
        </Link>
      </div>
      <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!canSkip}
          onClick={onContinue}
          className="gym-btn-primary h-12 w-full rounded-2xl disabled:opacity-40"
        >
          {canSkip ? "Kontynuuj" : "Reklama…"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

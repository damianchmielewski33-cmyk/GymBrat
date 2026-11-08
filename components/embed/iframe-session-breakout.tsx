"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  appDialogButtonClass,
} from "@/components/ui/app-dialog";
import { isLikelyInIframe, promoteGymBratOutOfIframe } from "@/lib/iframe-embed";

/**
 * Gdy GymBrat jest w iframe Academii — wyciągnij do pełnej karty / mostu APK.
 * Bez tego logowanie i sesja w osadzeniu często się wywalają (third-party cookies / OAuth).
 */
export function IframeSessionBreakout() {
  const [stuckInIframe, setStuckInIframe] = useState(false);

  useEffect(() => {
    // CSP frame-ancestors pozwala tylko Akademii — każdy iframe = problematyczny embed.
    if (!isLikelyInIframe()) return;

    const result = promoteGymBratOutOfIframe(window.location.href);
    if (result === "none") {
      setStuckInIframe(true);
      return;
    }
    // Most APK mógł otworzyć zewnętrzną przeglądarkę, a WebView dalej w iframe —
    // po chwili pokaż CTA, gdy nadal jesteśmy osadzeni.
    const t = window.setTimeout(() => {
      if (isLikelyInIframe()) setStuckInIframe(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, []);

  if (!stuckInIframe) return null;

  const href =
    typeof window !== "undefined" ? window.location.href : "https://gym-brat.vercel.app/";

  return (
    <AppDialog
      open
      onOpenChange={() => {}}
      role="alertdialog"
      tone="gold"
      icon={ExternalLink}
      overlayClassName="z-[1300]"
      className="z-[1301]"
      title="Otwórz GymBrat w pełnym oknie"
      description="W osadzonej karcie nie da się poprawnie zalogować ani utrzymać sesji."
    >
      <AppDialogActions>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={appDialogButtonClass("primary")}
          onClick={() => {
            promoteGymBratOutOfIframe(href);
          }}
        >
          Otwórz GymBrat
        </a>
      </AppDialogActions>
    </AppDialog>
  );
}

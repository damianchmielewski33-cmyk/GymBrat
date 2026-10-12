"use client";

import { useEffect, useState } from "react";
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
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[#07080d]/96 px-6 text-center text-white">
      <p className="font-heading text-xl font-semibold tracking-tight">
        Otwórz GymBrat poza Akademią
      </p>
      <p className="max-w-sm text-sm text-white/65">
        W osadzonej karcie nie da się poprawnie zalogować ani utrzymać sesji. Uruchom
        aplikację w pełnym oknie.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--neon)] px-6 text-sm font-semibold text-black"
        onClick={() => {
          promoteGymBratOutOfIframe(href);
        }}
      >
        Otwórz GymBrat
      </a>
    </div>
  );
}

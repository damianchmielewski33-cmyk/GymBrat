"use client";

import { useEffect, useState } from "react";
import { ProfileBlock } from "@/components/profile/profile-ui";
import {
  isIosPhoneBrowserClient,
  isRunningInIosAppWebView,
  parseIosAppIdentity,
} from "@/lib/app-webview";

/** RWD telefon — spójne z kartą Androida. */
const PHONE_RWD_MQ = "(max-width: 767px)";

function useIosPhoneRwd(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!isIosPhoneBrowserClient()) {
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

/**
 * Na iPhonie w Safari: instrukcja PWA bez Apple Developer.
 * W natywnym WKWebView: krótka informacja o wersji powłoki.
 */
export function IosInstallCard() {
  const iosPhoneRwd = useIosPhoneRwd();
  const [hydrated, setHydrated] = useState(false);
  const [iosApp, setIosApp] = useState(false);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    const inApp = isRunningInIosAppWebView();
    setIosApp(inApp);
    if (inApp) {
      const fromBridge = window.GymBratIos;
      try {
        if (fromBridge?.getVersionName) {
          const name = String(fromBridge.getVersionName());
          const code = Number(fromBridge.getVersionCode?.());
          setVersionLabel(
            Number.isFinite(code) ? `${name} (${code})` : name,
          );
          return;
        }
      } catch {
        /* most niedostępny */
      }
      const parsed = parseIosAppIdentity(navigator.userAgent);
      setVersionLabel(parsed?.versionName ?? null);
    }
  }, []);

  if (!hydrated) return null;

  if (iosApp) {
    return (
      <ProfileBlock
        title="Aplikacja iPhone"
        description="Natywna powłoka GymBrat (WKWebView). Interfejs to ta sama strona co w Safari."
      >
        <p className="text-sm text-white/70">
          {versionLabel
            ? `Wersja powłoki: ${versionLabel}`
            : "Powłoka iOS wykryta."}
        </p>
      </ProfileBlock>
    );
  }

  if (!iosPhoneRwd) return null;

  return (
    <ProfileBlock
      title="Aplikacja iPhone"
      description="Bez konta Apple Developer: dodaj ikonę z Safari. Nie rozsyłamy pliku IPA jak Androida APK."
    >
      <ol className="list-decimal space-y-2 pl-4 text-sm text-white/75">
        <li>Otwórz GymBrat w aplikacji Safari (nie tylko skrót z innej przeglądarki).</li>
        <li>Stuknij Udostępnij (kwadrat ze strzałką w górę).</li>
        <li>Wybierz „Dodaj do ekranu początkowego”, potem Dodaj.</li>
        <li>Od tej pory uruchamiaj GymBrat z nowej ikony — pełny ekran, bez paska adresu.</li>
      </ol>
      <p className="mt-3 text-xs text-white/45">
        Szczegóły i opcjonalny sideload na Macu: dokument w repozytorium{" "}
        <span className="text-white/60">docs/ios-instalacja-bez-developer.md</span>.
      </p>
    </ProfileBlock>
  );
}

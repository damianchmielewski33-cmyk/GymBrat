"use client";

import { useState, useTransition } from "react";
import { saveConsentAction, setSensitiveConsentAction } from "@/actions/consents";
import { ProfileSwitch } from "@/components/profile/profile-ui";
import {
  CURRENT_CONSENT_TEXT_VERSION,
  SENSITIVE_CONSENT_COPY,
} from "@/lib/consents-client";

export type SensitiveConsentsInitial = {
  health: boolean;
  photos: boolean;
  push: boolean;
};

/** Zgody na dane o ciele, zdjęcia i przypomnienia (US3/Z11, Z81). Cofnięcie działa od razu. */
export function SensitiveConsentsCard({ initial }: { initial: SensitiveConsentsInitial }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(key: keyof SensitiveConsentsInitial, value: boolean) {
    const previous = state[key];
    setState((s) => ({ ...s, [key]: value }));
    setError(null);
    start(async () => {
      let res;
      if (key === "push") {
        const fd = new FormData();
        fd.set("granted", value ? "1" : "0");
        fd.set("source", "profile");
        fd.set("textVersion", CURRENT_CONSENT_TEXT_VERSION);
        res = await saveConsentAction("push", null, fd);
      } else {
        res = await setSensitiveConsentAction(key, value, "profile");
      }
      if (!res.ok) {
        setState((s) => ({ ...s, [key]: previous }));
        setError(res.error);
      }
    });
  }

  return (
    <div className={`space-y-3 ${pending ? "opacity-80" : ""}`}>
      <div className="divide-y divide-white/[0.07]">
      <ProfileSwitch
        checked={state.health}
        onChange={(v) => change("health", v)}
        label="Dane o ciele i zdrowiu"
        description={SENSITIVE_CONSENT_COPY.health.body}
        disabled={pending}
      />
      <ProfileSwitch
        checked={state.photos}
        onChange={(v) => change("photos", v)}
        label="Zdjęcia sylwetki"
        description={SENSITIVE_CONSENT_COPY.photos.body}
        disabled={pending}
      />
      <ProfileSwitch
        checked={state.push}
        onChange={(v) => change("push", v)}
        label="Przypomnienia treningowe"
        description="Powiadomienia push i skrót e-mail o wybranej godzinie. Bez zgody nic nie wysyłamy."
        disabled={pending}
      />
      </div>
      <p className="text-xs leading-relaxed text-white/50">
        Cofnięcie zgody wstrzymuje dalszy zapis takich danych. Dane już zapisane usuniesz
        w ustawieniach konta (usunięcie konta kasuje wszystko).
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}

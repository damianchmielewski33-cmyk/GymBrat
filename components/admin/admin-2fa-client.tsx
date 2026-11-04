"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin-client";

type Status = {
  enrolled: boolean;
  pendingSetup: boolean;
  lockedUntil: number | null;
  recoveryCodesLeft: number;
  required: boolean;
  verified: boolean;
};

export function Admin2faClient() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await adminRequest<Status>("/api/admin/2fa", { fallbackError: "Nie udało się pobrać statusu 2FA." });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStatus(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(body: Record<string, unknown>, onOk?: (data: Record<string, unknown>) => void) {
    setBusy(true);
    setError(null);
    const res = await adminRequest<Record<string, unknown>>("/api/admin/2fa", {
      method: "POST",
      body,
      fallbackError: "Operacja nie powiodła się.",
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setCode("");
    onOk?.(res.data);
    return true;
  }

  const startSetup = () =>
    call({ action: "setup" }, (d) => setSetup({ secret: String(d.secret), uri: String(d.uri) }));

  const enable = async () => {
    await call({ action: "enable", code }, (d) => {
      setCodes(d.recoveryCodes as string[]);
      setSetup(null);
      void load();
    });
  };

  const verify = async () => {
    const ok = await call({ action: "verify", code });
    if (ok) {
      router.push("/admin/overview");
      router.refresh();
    }
  };

  const regenerate = () =>
    call({ action: "regenerate", code }, (d) => {
      setCodes(d.recoveryCodes as string[]);
      void load();
    });

  const disable = async () => {
    if (await call({ action: "disable", code })) void load();
  };

  if (!status) {
    return (
      <ScreenCard className="mx-auto max-w-lg">
        <p className="text-sm text-white/60">{error ?? "Ładowanie…"}</p>
      </ScreenCard>
    );
  }

  const codeInput = (
    <Input
      inputMode="text"
      autoComplete="one-time-code"
      placeholder="Kod z aplikacji (6 cyfr) lub awaryjny"
      value={code}
      onChange={(e) => setCode(e.target.value)}
      maxLength={32}
    />
  );

  return (
    <ScreenCard className="mx-auto max-w-lg space-y-4">
      <ScreenHeading
        showBrand
        title="Weryfikacja dwuskładnikowa"
        description="Panel administratora chroni drugi składnik: kod z aplikacji uwierzytelniającej (TOTP)."
      />
      {!status.required ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[13px] text-amber-100">
          Wymóg 2FA jest wyłączony (ADMIN_2FA_REQUIRED). Skonfiguruj 2FA i sprawdź, że kod działa, a dopiero potem włącz wymóg na hostingu.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {codes ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white">Kody awaryjne — zapisz je teraz</p>
          <p className="text-[13px] text-white/65">Każdy działa raz i zastępuje kod z aplikacji. Nie pokażemy ich ponownie.</p>
          <pre className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white">{codes.join("\n")}</pre>
          <Button type="button" onClick={() => setCodes(null)}>
            Zapisałem kody
          </Button>
        </div>
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-[13px] text-white/70">
            Dodaj konto w aplikacji uwierzytelniającej (Google Authenticator, Aegis…) wpisując klucz ręcznie, a następnie podaj pierwszy kod.
          </p>
          <pre className="break-all whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white">{setup.secret}</pre>
          <a href={setup.uri} className="text-[13px] text-[var(--gym-gold)] underline">
            Otwórz w aplikacji (otpauth)
          </a>
          {codeInput}
          <Button type="button" disabled={busy} onClick={() => void enable()}>
            Potwierdź i włącz 2FA
          </Button>
        </div>
      ) : !status.enrolled ? (
        <Button type="button" disabled={busy} onClick={() => void startSetup()}>
          Skonfiguruj 2FA
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-white/80">
            <ShieldCheck className="size-4 text-emerald-300" aria-hidden />
            2FA włączone · pozostało kodów awaryjnych: {status.recoveryCodesLeft}
            {status.verified ? " · sesja zweryfikowana" : ""}
          </p>
          {status.lockedUntil ? (
            <p className="text-[13px] text-rose-300">Zbyt wiele błędnych kodów — spróbuj po {new Date(status.lockedUntil).toLocaleTimeString("pl-PL")}.</p>
          ) : null}
          {codeInput}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !code} onClick={() => void verify()}>
              Wejdź do panelu
            </Button>
            <Button type="button" variant="outline" disabled={busy || !code} onClick={() => void regenerate()}>
              Nowe kody awaryjne
            </Button>
            <Button type="button" variant="outline" disabled={busy || !code} onClick={() => void disable()}>
              Wyłącz 2FA
            </Button>
          </div>
        </div>
      )}
      <Link href="/admin/overview" className="block text-[13px] text-white/55 underline">
        Wróć do panelu
      </Link>
    </ScreenCard>
  );
}

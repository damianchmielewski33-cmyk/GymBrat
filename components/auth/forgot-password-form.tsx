"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, FlaskConical } from "lucide-react";
import {
  requestPasswordReset,
  resetPassword,
} from "@/actions/password-reset";
import { OFFLINE_REGISTER_MESSAGE } from "@/components/auth/auth-copy";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { plural } from "@/lib/progress-format";
import { cn } from "@/lib/utils";

const RESEND_COOLDOWN_SECONDS = 60;

type Step = "email" | "reset" | "done";

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function ForgotPasswordForm({
  available,
  testCode = null,
}: {
  /** Czy serwer może wysłać (lub zasymulować) kod — `false` = brak SMTP na hostingu. */
  available: boolean;
  /** Kod trybu testowego (tylko lokalnie, bez SMTP); na produkcji zawsze `null`. */
  testCode?: string | null;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{
    email?: string;
    code?: string;
    password?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function sendCode(): Promise<boolean> {
    setError(null);
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setFieldError({ email: "Wpisz poprawny adres e-mail." });
      return false;
    }
    setFieldError({});
    if (isOffline()) {
      setError(OFFLINE_REGISTER_MESSAGE);
      return false;
    }
    setBusy(true);
    try {
      const res = await requestPasswordReset({ email: value });
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch {
      setError("Nie udało się wysłać kodu. Spróbuj ponownie za chwilę.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (await sendCode()) setStep("reset");
  }

  async function onSubmitReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const next: typeof fieldError = {};
    if (!/^\d{6}$/.test(code)) next.code = "Wpisz 6-cyfrowy kod z e-maila.";
    if (password.length < 8) next.password = "Użyj minimum 8 znaków.";
    setFieldError(next);
    if (next.code || next.password) return;
    if (isOffline()) {
      setError(OFFLINE_REGISTER_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const res = await resetPassword({ email: email.trim(), code, password });
      if (!res.ok) {
        setError(res.error);
        if (res.code === "code_invalid") setFieldError({ code: " " });
        return;
      }
      setPassword("");
      setStep("done");
    } catch {
      setError("Nie udało się zmienić hasła. Spróbuj ponownie za chwilę.");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || busy) return;
    if (await sendCode()) setError(null);
  }

  const titles: Record<Step, { headline: string; support: string }> = {
    email: {
      headline: "Nie pamiętasz hasła?",
      support: "Podaj e-mail konta. Wyślemy kod do ustawienia nowego hasła.",
    },
    reset: {
      headline: "Ustaw nowe hasło",
      support: `Jeśli konto istnieje, kod jest już w drodze na ${email.trim()}. Jest ważny 10 minut.`,
    },
    done: {
      headline: "Hasło zmienione",
      support: "Wylogowaliśmy Cię ze wszystkich urządzeń. Zaloguj się nowym hasłem.",
    },
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <AuthHeroBrand
        compact
        headline={titles[step].headline}
        support={titles[step].support}
      />
      <AuthCard bodyClassName="space-y-5">
        {!available ? (
          <div className="space-y-4">
            <InlineBanner role="status" variant="warning">
              Zmiana hasła e-mailem jest chwilowo niedostępna. Spróbuj ponownie
              później albo zaloguj się przez Google lub Facebook, jeśli tak
              zakładałeś konto.
            </InlineBanner>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "cta" }), "w-full")}
            >
              Wróć do logowania
            </Link>
          </div>
        ) : step === "done" ? (
          <div className="space-y-5 text-center">
            <CheckCircle2
              className="mx-auto h-12 w-12 text-emerald-300"
              aria-hidden
            />
            <p className="text-sm text-white/65">
              Jeśli to nie Ty zmieniałeś hasło, napisz do nas od razu.
            </p>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "cta" }), "w-full")}
            >
              Przejdź do logowania
            </Link>
          </div>
        ) : (
          <>
            {testCode ? (
              <InlineBanner role="status" variant="warning">
                <span className="flex items-start gap-2">
                  <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    <strong className="block font-semibold">Tryb testowy</strong>
                    E-maile nie są wysyłane. Użyj kodu {testCode}.
                  </span>
                </span>
              </InlineBanner>
            ) : null}
            {error ? (
              <InlineBanner role="alert" variant="error">
                {error}
              </InlineBanner>
            ) : null}

            {step === "email" ? (
              <form className="space-y-5" noValidate onSubmit={onSubmitEmail}>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    placeholder="twoj@email.pl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={fieldError.email ? true : undefined}
                    aria-describedby={fieldError.email ? "reset-email-error" : undefined}
                  />
                  {fieldError.email ? (
                    <p id="reset-email-error" className="text-xs text-red-100">
                      {fieldError.email}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  variant="cta"
                  className="w-full"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? "Wysyłanie…" : "Wyślij kod"}
                </Button>
              </form>
            ) : (
              <form className="space-y-5" noValidate onSubmit={onSubmitReset}>
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Kod z e-maila</Label>
                  <Input
                    id="reset-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="6 cyfr"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    aria-invalid={fieldError.code ? true : undefined}
                    aria-describedby={fieldError.code?.trim() ? "reset-code-error" : undefined}
                  />
                  {fieldError.code?.trim() ? (
                    <p id="reset-code-error" className="text-xs text-red-100">
                      {fieldError.code}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">Nowe hasło</Label>
                  <div className="relative">
                    <Input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={fieldError.password ? true : undefined}
                      aria-describedby="reset-password-hint"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 flex h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)]"
                      aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <p
                    id="reset-password-hint"
                    className={cn(
                      "text-xs",
                      fieldError.password ? "text-red-100" : "text-white/50",
                    )}
                  >
                    Minimum 8 znaków.
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="cta"
                  className="w-full"
                  disabled={busy}
                  aria-busy={busy}
                >
                  {busy ? "Zapisywanie…" : "Zmień hasło"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-white/70"
                  disabled={cooldown > 0 || busy}
                  onClick={() => void onResend()}
                >
                  {cooldown > 0
                    ? `Wyślij kod ponownie za ${cooldown} ${plural(cooldown, "sekundę", "sekundy", "sekund")}`
                    : "Wyślij kod ponownie"}
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-white/55">
              <Link
                href="/login"
                className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                Wróć do logowania
              </Link>
            </p>
          </>
        )}
      </AuthCard>
    </div>
  );
}

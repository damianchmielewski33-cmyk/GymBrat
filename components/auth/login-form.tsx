"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { RoleAuthCards } from "@/components/auth/role-auth-cards";
import { InlineBanner } from "@/components/ui/inline-banner";
import {
  isTrainerFlowEnabled,
  roleFromSearchParam,
  type AppRole,
} from "@/lib/auth-role";

type LoginMode = "pin" | "email";

/** @deprecated użyj AppRole z @/lib/auth-role */
export type LoginRole = AppRole;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const registered = params.get("registered");
  const fromAwp = params.get("from") === "awp";
  const trainerEnabled = isTrainerFlowEnabled();
  const roleFromUrl = roleFromSearchParam(params.get("role"));
  const role: AppRole = trainerEnabled ? roleFromUrl : "zawodnik";
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [mode, setMode] = useState<LoginMode>("pin");

  useEffect(() => {
    if (trainerEnabled) return;
    if (params.get("role") === "trener") {
      const next = new URLSearchParams(params.toString());
      next.set("role", "zawodnik");
      router.replace(`/login?${next.toString()}`);
    }
  }, [trainerEnabled, params, router]);

  function onSelectRole(next: AppRole) {
    if (!trainerEnabled && next === "trener") return;
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("role", next);
    router.replace(`/login?${nextParams.toString()}`);
  }

  const registerHref = "/register?role=zawodnik";
  const hasBanner =
    Boolean(registered && !error) || Boolean(error) || Boolean(fromAwp && !error);

  function goAfterLogin() {
    try {
      const target = new URL(callbackUrl, window.location.origin).href;
      window.location.assign(target);
    } catch {
      window.location.assign(`${window.location.origin}/`);
    }
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          try {
            const res =
              mode === "pin"
                ? await signIn("credentials", {
                    firstName: String(fd.get("firstName") ?? ""),
                    lastName: String(fd.get("lastName") ?? ""),
                    pin: String(fd.get("pin") ?? ""),
                    mode: "pin",
                    role,
                    redirect: false,
                    callbackUrl,
                  })
                : await signIn("credentials", {
                    email: String(fd.get("email") ?? ""),
                    password: String(fd.get("password") ?? ""),
                    mode: "email",
                    role,
                    redirect: false,
                    callbackUrl,
                  });

            if (!res) {
              setError("Brak odpowiedzi serwera przy logowaniu.");
              return;
            }
            if (res.error) {
              setError(
                mode === "pin"
                  ? "Nieprawidłowe imię, nazwisko lub PIN — użyj tych samych danych co w Akademii Wielkich Piłkarzy."
                  : "Nieprawidłowy e-mail lub hasło, albo typ konta (zawodnik / trener) nie zgadza się z profilem.",
              );
              return;
            }
            if (!res.ok) {
              setError("Nie udało się zalogować. Spróbuj ponownie za chwilę.");
              return;
            }
            goAfterLogin();
          } catch {
            setError("Logowanie nie powiodło się. Spróbuj ponownie za chwilę.");
          }
        });
      }}
    >
      <RoleAuthCards
        role={role}
        onSelectRole={onSelectRole}
        trainerLocked={!trainerEnabled}
        heading="Logujesz się jako"
      />

      {hasBanner ? (
        <div className="space-y-2">
          {fromAwp && !error ? (
            <InlineBanner id="login-banner" role="status" variant="success">
              Wspólne konto z Akademią — zaloguj się imieniem, nazwiskiem i PIN-em
              jak na stronie Akademii.
            </InlineBanner>
          ) : null}
          {registered && !error ? (
            <InlineBanner id="login-banner" role="status" variant="success">
              Konto utworzone. Zaloguj się, aby kontynuować.
            </InlineBanner>
          ) : null}
          {error ? (
            <InlineBanner id="login-banner" role="alert" variant="error">
              {error}
            </InlineBanner>
          ) : null}
        </div>
      ) : null}

      {mode === "pin" ? (
        <>
          <p className="text-sm text-white/55">
            Te same dane co w Akademii Wielkich Piłkarzy: imię, nazwisko i PIN
            (4–6 cyfr).
          </p>
          <div className="space-y-2">
            <Label htmlFor="firstName">Imię</Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              aria-invalid={error ? true : undefined}
              aria-describedby={hasBanner ? "login-banner" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nazwisko</Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              aria-invalid={error ? true : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <div className="relative">
              <Input
                id="pin"
                name="pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                minLength={4}
                maxLength={6}
                required
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                className="pr-12"
                placeholder="4–6 cyfr"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-1 top-1/2 flex h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
                aria-label={showPin ? "Ukryj PIN" : "Pokaż PIN"}
                aria-pressed={showPin}
              >
                {showPin ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-invalid={error ? true : undefined}
              aria-describedby={hasBanner ? "login-banner" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 flex h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
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
          </div>
        </>
      )}

      <Button
        type="submit"
        variant="cta"
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending
          ? "Logowanie…"
          : role === "trener"
            ? "Zaloguj się jako trener"
            : "Zaloguj się jako zawodnik"}
      </Button>

      <button
        type="button"
        className="w-full text-center text-sm text-white/55 underline-offset-4 hover:text-white hover:underline"
        onClick={() => {
          setError(null);
          setMode((m) => (m === "pin" ? "email" : "pin"));
        }}
      >
        {mode === "pin"
          ? "Zaloguj e-mailem i hasłem"
          : "Zaloguj imieniem, nazwiskiem i PIN-em (jak w Akademii)"}
      </button>

      <p className="text-center text-sm text-white/55">
        Nie masz konta?{" "}
        <Link
          href={registerHref}
          className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
        >
          Utwórz konto
        </Link>
      </p>
    </form>
  );
}

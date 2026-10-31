"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState, useTransition } from "react";
import {
  LOGIN_RATE_LIMITED_CODE,
  SESSION_EXPIRED_PARAM,
} from "@/lib/auth-error-codes";
import { safeCallbackPath } from "@/lib/safe-callback-url";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  AuthProviderDivider,
  FacebookSignInButton,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in-button";
import {
  oauthErrorMessage,
  SESSION_EXPIRED_MESSAGE,
} from "@/components/auth/auth-copy";
import { OAuthPrivacyNote } from "@/components/auth/oauth-privacy-note";
import { RoleAuthCards } from "@/components/auth/role-auth-cards";
import { InlineBanner } from "@/components/ui/inline-banner";
import {
  isTrainerFlowEnabled,
  roleFromSearchParam,
  type AppRole,
} from "@/lib/auth-role";

/** @deprecated użyj AppRole z @/lib/auth-role */
export type LoginRole = AppRole;

export function LoginForm({
  googleEnabled = false,
  facebookEnabled = false,
}: {
  googleEnabled?: boolean;
  facebookEnabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const callbackUrl = safeCallbackPath(params.get("callbackUrl"));
  const registered = params.get("registered");
  const oauthExisting = params.get("oauth") === "existing";
  const trainerEnabled = isTrainerFlowEnabled();
  const roleFromUrl = roleFromSearchParam(params.get("role"));
  const role: AppRole = trainerEnabled ? roleFromUrl : "zawodnik";
  // Odczyt jednorazowy: parametry `error` / `session` czyścimy z adresu niżej.
  const [oauthError, setOauthError] = useState(() =>
    oauthErrorMessage(params.get("error")),
  );
  const [sessionExpired, setSessionExpired] = useState(
    () => params.get("session") === SESSION_EXPIRED_PARAM,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [pending, start] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (trainerEnabled) return;
    if (params.get("role") === "trener") {
      const next = new URLSearchParams(params.toString());
      next.set("role", "zawodnik");
      router.replace(`/login?${next.toString()}`);
    }
  }, [trainerEnabled, params, router]);

  useEffect(() => {
    if (!params.has("error") && !params.has("session")) return;
    const next = new URLSearchParams(params.toString());
    next.delete("error");
    next.delete("session");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [params, pathname, router]);

  function onSelectRole(next: AppRole) {
    if (!trainerEnabled && next === "trener") return;
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("role", next);
    router.replace(`/login?${nextParams.toString()}`);
  }

  const registerHref = "/register?role=zawodnik";
  const hasBanner = Boolean(registered && !error) || Boolean(error);

  if (oauthExisting) {
    return (
      <div className="space-y-6">
        <InlineBanner role="status" variant="success">
          To konto Google jest już zarejestrowane w GymBrat — nie tworzymy
          drugiego. Możesz wejść do aplikacji albo wrócić do rejestracji innym
          sposobem.
        </InlineBanner>
        <Button
          type="button"
          variant="cta"
          className="w-full"
          onClick={() => {
            window.location.assign(`${window.location.origin}/`);
          }}
        >
          Wejdź do GymBrat
        </Button>
        <p className="text-center text-sm text-white/55">
          Chcesz inne konto?{" "}
          <Link
            href={registerHref}
            className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline"
          >
            Wróć do rejestracji
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        const password = String(fd.get("password") ?? "");
        // Puste pola łapiemy w przeglądarce — nie zużywamy limitu prób logowania na serwerze.
        const nextFieldErrors: { email?: string; password?: string } = {};
        if (!email.trim()) nextFieldErrors.email = "Wpisz adres e-mail.";
        else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
          nextFieldErrors.email = "Wpisz poprawny adres e-mail.";
        if (!password) nextFieldErrors.password = "Wpisz hasło.";
        setFieldErrors(nextFieldErrors);
        if (nextFieldErrors.email || nextFieldErrors.password) {
          setError(null);
          document
            .getElementById(nextFieldErrors.email ? "email" : "password")
            ?.focus();
          return;
        }
        setError(null);
        setOauthError(null);
        setSessionExpired(false);
        start(async () => {
          try {
            const res = await signIn("credentials", {
              email,
              password,
              role,
              redirect: false,
              callbackUrl,
            });
            if (!res) {
              setError("Brak odpowiedzi serwera przy logowaniu.");
              return;
            }
            if (res.error) {
              if (res.code === LOGIN_RATE_LIMITED_CODE) {
                setError(
                  "Zbyt wiele prób logowania. Odczekaj kilka minut i spróbuj ponownie.",
                );
                return;
              }
              setError(
                trainerEnabled
                  ? "Nieprawidłowy e-mail lub hasło, albo typ konta (zawodnik / trener) nie zgadza się z profilem."
                  : "Nieprawidłowy e-mail lub hasło. Sprawdź dane i spróbuj ponownie.",
              );
              return;
            }
            if (!res.ok) {
              setError(
                "Nie udało się zalogować. Spróbuj ponownie za chwilę.",
              );
              return;
            }
            try {
              const target = new URL(callbackUrl, window.location.origin).href;
              window.location.assign(target);
            } catch {
              window.location.assign(`${window.location.origin}/`);
            }
          } catch {
            setError(
              "Logowanie nie powiodło się. Spróbuj ponownie za chwilę.",
            );
          }
        });
      }}
    >
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">
          Zaloguj się
        </h2>
        <p className="text-sm text-white/55">
          Wróć do swoich planów i historii treningów.
        </p>
      </div>

      {oauthError ? (
        <InlineBanner role="alert" variant="error">
          {oauthError}
        </InlineBanner>
      ) : sessionExpired ? (
        <InlineBanner role="status" variant="info">
          {SESSION_EXPIRED_MESSAGE}
        </InlineBanner>
      ) : null}

      {trainerEnabled ? (
        <RoleAuthCards
          role={role}
          onSelectRole={onSelectRole}
          trainerLocked={false}
          heading="Logujesz się jako"
        />
      ) : null}

      {googleEnabled || facebookEnabled ? (
        <div className="space-y-3">
          {googleEnabled ? (
            <GoogleSignInButton
              redirectTo="/complete-profile"
              label="Zaloguj się przez Google"
            />
          ) : null}
          {facebookEnabled ? (
            <FacebookSignInButton
              redirectTo="/complete-profile"
              label="Zaloguj się przez Facebook"
            />
          ) : null}
          <AuthProviderDivider label="lub e-mailem" />
          <OAuthPrivacyNote />
        </div>
      ) : null}

      {hasBanner ? (
        <div className="space-y-2">
          {registered && !error ? (
            <InlineBanner
              id="login-banner"
              role="status"
              variant="success"
            >
              Konto utworzone. Zaloguj się, aby kontynuować.
            </InlineBanner>
          ) : null}
          {error ? (
            <InlineBanner
              id="login-banner"
              role="alert"
              variant="error"
            >
              {error}
            </InlineBanner>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="twoj@email.pl"
          aria-invalid={error || fieldErrors.email ? true : undefined}
          aria-describedby={
            fieldErrors.email
              ? "email-error"
              : hasBanner
                ? "login-banner"
                : undefined
          }
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-xs text-red-100">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="password">Hasło</Label>
          <Link
            href="/forgot-password"
            className="rounded-sm text-xs text-white/65 underline-offset-4 hover:text-[var(--neon)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            Nie pamiętasz hasła?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={error || fieldErrors.password ? true : undefined}
            aria-describedby={
              fieldErrors.password
                ? "password-error"
                : hasBanner
                  ? "login-banner"
                  : undefined
            }
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
        {fieldErrors.password ? (
          <p id="password-error" className="text-xs text-red-100">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        variant="cta"
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending
          ? "Logowanie…"
          : trainerEnabled && role === "trener"
            ? "Zaloguj się jako trener"
            : "Zaloguj się"}
      </Button>
      <div className="space-y-3 border-t border-white/10 pt-5">
        <p className="text-center text-sm text-white/60">Pierwszy raz w GymBrat?</p>
        <Link
          href={registerHref}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 w-full border-white/20 bg-white/[0.04] font-semibold text-white hover:bg-white/[0.08]",
          )}
        >
          Utwórz konto
        </Link>
      </div>
      <p className="text-center text-[13px] text-white/65">
        <Link href="/regulamin" className="underline-offset-2 hover:underline">
          Regulamin
        </Link>
        {" · "}
        <Link
          href="/polityka-prywatnosci"
          className="underline-offset-2 hover:underline"
        >
          Polityka prywatności
        </Link>
      </p>
    </form>
  );
}

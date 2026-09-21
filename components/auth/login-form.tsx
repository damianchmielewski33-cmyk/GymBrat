"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { InlineBanner } from "@/components/ui/inline-banner";

export function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const registered = params.get("registered");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const hasBanner = Boolean(registered && !error) || Boolean(error);

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        const password = String(fd.get("password") ?? "");
        setError(null);
        start(async () => {
          try {
            const res = await signIn("credentials", {
              email,
              password,
              redirect: false,
              callbackUrl,
            });
            if (!res) {
              setError("Brak odpowiedzi serwera przy logowaniu.");
              return;
            }
            if (res.error) {
              setError("Nieprawidłowy e-mail lub hasło.");
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
        <Label htmlFor="email">
          Email
        </Label>
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
        <Label htmlFor="password">
          Hasło
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={hasBanner ? "login-banner" : undefined}
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
      <Button
        type="submit"
        variant="cta"
        disabled={pending}
        aria-busy={pending}
        className="w-full"
      >
        {pending ? "Logowanie…" : "Zaloguj się"}
      </Button>
      <p className="text-center text-sm text-white/55">
        Nie masz konta?{" "}
        <Link
          href="/register"
          className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
        >
          Utwórz konto
        </Link>
      </p>
    </form>
  );
}

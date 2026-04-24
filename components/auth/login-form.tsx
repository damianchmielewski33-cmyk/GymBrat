"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { RoleAuthCards } from "@/components/auth/role-auth-cards";
import {
  isTrainerFlowEnabled,
  roleFromSearchParam,
  type AppRole,
} from "@/lib/auth-role";

/** @deprecated użyj AppRole z @/lib/auth-role */
export type LoginRole = AppRole;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const registered = params.get("registered");
  const trainerEnabled = isTrainerFlowEnabled();
  const roleFromUrl = roleFromSearchParam(params.get("role"));
  const role: AppRole = trainerEnabled ? roleFromUrl : "zawodnik";
  const [error, setError] = useState<string | null>(null);
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

  function onSelectRole(next: AppRole) {
    if (!trainerEnabled && next === "trener") return;
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("role", next);
    router.replace(`/login?${nextParams.toString()}`);
  }

  const registerHref = "/register?role=zawodnik";
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
                "Nieprawidłowy e-mail lub hasło, albo typ konta (zawodnik / trener) nie zgadza się z profilem.",
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
      <RoleAuthCards
        role={role}
        onSelectRole={onSelectRole}
        trainerLocked={!trainerEnabled}
        heading="Logujesz się jako"
      />

      {hasBanner ? (
        <div className="space-y-2">
          {registered && !error ? (
            <p
              id="login-banner"
              role="status"
              aria-live="polite"
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
            >
              Konto utworzone. Zaloguj się, aby kontynuować.
            </p>
          ) : null}
          {error ? (
            <p
              id="login-banner"
              role="alert"
              aria-live="assertive"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/85">
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
          className="min-h-11 border-white/20 bg-black/50 text-white placeholder:text-white/40"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/85">
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
            className={cn(
              "min-h-11 border-white/20 bg-black/50 pr-12 text-white placeholder:text-white/40",
            )}
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
        disabled={pending}
        aria-busy={pending}
        className="h-11 w-full bg-[var(--neon)] text-base font-semibold text-white hover:bg-[#ff4d6d] focus-visible:ring-2 focus-visible:ring-white/95 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]"
      >
        {pending
          ? "Logowanie…"
          : role === "trener"
            ? "Zaloguj się jako trener"
            : "Zaloguj się jako zawodnik"}
      </Button>
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

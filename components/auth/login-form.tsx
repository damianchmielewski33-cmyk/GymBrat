"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { cn } from "@/lib/utils";
import {
  loginSchema,
  type LoginFormValues,
} from "@/lib/validations/login";

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
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

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

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: values.email.trim(),
        password: values.password,
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
        setError("Nie udało się zalogować. Spróbuj ponownie za chwilę.");
        return;
      }
      try {
        const target = new URL(callbackUrl, window.location.origin).href;
        window.location.assign(target);
      } catch {
        window.location.assign(`${window.location.origin}/`);
      }
    } catch {
      setError("Logowanie nie powiodło się. Spróbuj ponownie za chwilę.");
    }
  }

  const registerHref = "/register?role=zawodnik";
  const hasBanner = Boolean(registered && !error) || Boolean(error);
  const emailDescribedBy = [
    errors.email ? "login-error-email" : "",
    hasBanner ? "login-banner" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const passwordDescribedBy = [
    errors.password ? "login-error-password" : "",
    hasBanner ? "login-banner" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
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
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={emailDescribedBy || undefined}
          className={cn(errors.email && "border-destructive")}
          {...register("email")}
        />
        {errors.email ? (
          <p id="login-error-email" className="text-xs text-red-100">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">
          Hasło
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={passwordDescribedBy || undefined}
            className={cn("pr-12", errors.password && "border-destructive")}
            {...register("password")}
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
        {errors.password ? (
          <p id="login-error-password" className="text-xs text-red-100">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        variant="cta"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="w-full"
      >
        {isSubmitting
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

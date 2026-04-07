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

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        const password = String(fd.get("password") ?? "");
        setError(null);
        start(async () => {
          const res = await signIn("credentials", {
            email,
            password,
            role,
            redirect: false,
            callbackUrl,
          });
          if (res?.error) {
            setError(
              "Nieprawidłowy e-mail lub hasło, albo typ konta (zawodnik / trener) nie zgadza się z profilem.",
            );
            return;
          }
          router.push(callbackUrl);
          router.refresh();
        });
      }}
    >
      <RoleAuthCards
        role={role}
        onSelectRole={onSelectRole}
        trainerLocked={!trainerEnabled}
        heading="Logujesz się jako"
      />

      {registered ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Konto utworzone. Zaloguj się, aby kontynuować.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 border-white/15 bg-black/40"
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
            className={cn(
              "h-10 border-white/15 bg-black/40 pr-11",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/50"
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
        className="h-11 w-full bg-[var(--neon)] text-base font-semibold text-white hover:bg-[#ff4d6d]"
      >
        {pending
          ? "Logowanie…"
          : role === "trener"
            ? "Zaloguj się jako trener"
            : "Zaloguj się jako zawodnik"}
      </Button>
      <p className="text-center text-sm text-white/55">
        Nie masz konta?{" "}
        <Link href={registerHref} className="text-[var(--neon)] hover:underline">
          Utwórz konto
        </Link>
      </p>
    </form>
  );
}

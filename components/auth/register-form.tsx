"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Dumbbell, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { registerUser, sendRegisterCode, type RegisterState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  isTrainerFlowEnabled,
  roleFromSearchParam,
} from "@/lib/auth-role";
import { RoleAuthCards } from "@/components/auth/role-auth-cards";
import {
  activityLevels,
  registerSchema,
  type RegisterFormValues,
} from "@/lib/validations/register";

const inputClass =
  "border-white/15 bg-black/40 text-white placeholder:text-white/35 focus-visible:border-[var(--neon)]/50 focus-visible:ring-[var(--neon)]/25";

const activityCopy: Record<
  (typeof activityLevels)[number],
  { label: string; hint: string }
> = {
  low: { label: "Niska", hint: "Biurko / lekkie spacery" },
  medium: { label: "Średnia", hint: "3–5 treningów / tydzień" },
  high: { label: "Wysoka", hint: "Codziennie lub intensywnie" },
};

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trainerEnabled = isTrainerFlowEnabled();
  const roleFromUrl = roleFromSearchParam(searchParams.get("role"));
  const role = trainerEnabled ? roleFromUrl : "zawodnik";
  const [rootError, setRootError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (trainerEnabled) return;
    if (searchParams.get("role") === "trener") {
      const next = new URLSearchParams(searchParams.toString());
      next.set("role", "zawodnik");
      router.replace(`/register?${next.toString()}`);
    }
  }, [trainerEnabled, searchParams, router]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      emailCode: "",
      password: "",
      weightKg: "",
      heightCm: "",
      age: "",
      activityLevel: "medium",
      role: "zawodnik",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const activityLevel = watch("activityLevel");
  const emailValue = watch("email");
  const emailCodeValue = watch("emailCode");
  const [codeInfo, setCodeInfo] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  const cooldownSeconds = useMemo(() => {
    if (!cooldownUntil) return 0;
    const diffMs = cooldownUntil - Date.now();
    return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
  }, [cooldownUntil]);

  useEffect(() => {
    if (!cooldownUntil) return;
    if (cooldownSeconds <= 0) return;
    const t = window.setInterval(() => {
      setCooldownUntil((v) => (v && v > Date.now() ? v : null));
    }, 250);
    return () => window.clearInterval(t);
  }, [cooldownUntil, cooldownSeconds]);

  useEffect(() => {
    const raw = (emailCodeValue ?? "").toString();
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    if (digits !== raw) {
      setValue("emailCode", digits, { shouldValidate: digits.length === 6 });
    }
    if (digits.length === 6) {
      queueMicrotask(() => passwordRef.current?.focus());
    }
  }, [emailCodeValue, setValue]);

  async function onSubmit(values: RegisterFormValues) {
    setRootError(null);
    setCodeInfo(null);
    const result: RegisterState = await registerUser(values);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [key, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) {
            setError(key as keyof RegisterFormValues, {
              message: messages[0],
            });
          }
        }
      }
      setRootError(result.error);
      return;
    }

    let sign: Awaited<ReturnType<typeof signIn>> | null = null;
    try {
      sign = await signIn("credentials", {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: values.role,
        redirect: false,
        callbackUrl: "/start-workout",
      });
    } catch {
      setRootError(
        "Konto zostało utworzone, ale nie udało się zalogować automatycznie. Zaloguj się ręcznie.",
      );
      return;
    }
    if (!sign?.ok || sign.error) {
      setRootError(
        "Konto zostało utworzone, ale nie udało się zalogować automatycznie. Zaloguj się ręcznie.",
      );
      return;
    }
    window.location.assign(`${window.location.origin}/start-workout`);
  }

  const { ref: passwordRhfRef, ...passwordRegister } = register("password");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[1.05rem] bg-gradient-to-br from-[var(--neon)]/25 via-white/[0.07] to-cyan-400/10 opacity-90 blur-[1px]"
      />
      <div className="glass-panel relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-white/[0.09] to-black/25 p-6 shadow-[0_12px_60px_rgba(0,0,0,0.55)] sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(-12deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_8px)]"
        />
        <div className="relative">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.12] to-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              <Dumbbell className="h-6 w-6 text-[var(--neon)]" strokeWidth={1.75} />
            </div>
            <Link href="/" className="font-heading text-2xl font-semibold tracking-tight">
              Gym<span className="text-[var(--neon)]">Brat</span>
            </Link>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-white/55">
              <Sparkles className="h-3.5 w-3.5 text-[var(--neon)]/80" />
              Zbuduj swój profil sportowca
            </p>
          </div>

          <RoleAuthCards
            role={role}
            onSelectRole={(next) => {
              if (!trainerEnabled && next === "trener") return;
              const nextParams = new URLSearchParams(searchParams.toString());
              nextParams.set("role", next);
              router.replace(`/register?${nextParams.toString()}`);
            }}
            trainerLocked={!trainerEnabled}
            heading="Tworzysz konto jako"
          />

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            {rootError ? (
              <p
                role="alert"
                className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-100"
              >
                {rootError}
              </p>
            ) : null}

            <input type="hidden" {...register("role")} />

            <div className="space-y-4 rounded-xl border border-white/[0.08] bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
              <p className="metallic-text text-xs font-semibold uppercase tracking-[0.2em]">
                Dane podstawowe
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-white/80">
                    Imię
                  </Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    className={cn(inputClass, errors.firstName && "border-destructive")}
                    {...register("firstName")}
                  />
                  {errors.firstName ? (
                    <p className="text-xs text-red-300">{errors.firstName.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-white/80">
                    Nazwisko
                  </Label>
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    className={cn(inputClass, errors.lastName && "border-destructive")}
                    {...register("lastName")}
                  />
                  {errors.lastName ? (
                    <p className="text-xs text-red-300">{errors.lastName.message}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={cn(inputClass, errors.email && "border-destructive")}
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="text-xs text-red-300">{errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="emailCode" className="text-white/80">
                      Kod z e-maila
                    </Label>
                    <Input
                      id="emailCode"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      className={cn(inputClass, errors.emailCode && "border-destructive")}
                      {...register("emailCode")}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={sendingCode || !emailValue?.trim() || cooldownSeconds > 0}
                    className="h-10 shrink-0 bg-white/10 text-white hover:bg-white/15"
                    onClick={async () => {
                      setRootError(null);
                      setCodeInfo(null);
                      const email = (emailValue ?? "").trim().toLowerCase();
                      if (!email) {
                        setRootError("Wpisz e-mail, aby wysłać kod.");
                        return;
                      }
                      setSendingCode(true);
                      try {
                        const res = await sendRegisterCode({ email });
                        if (!res.ok) {
                          setRootError(res.error);
                          return;
                        }
                        setCodeInfo("Kod wysłany. Sprawdź skrzynkę (oraz SPAM) i wpisz 6 cyfr.");
                        setCooldownUntil(Date.now() + 60_000);
                      } catch {
                        setRootError(
                          "Nie udało się wysłać kodu. Sprawdź SMTP w Vercel (SMTP_HOST, SMTP_USER, SMTP_PASS) i ewentualnie hasło aplikacji Gmail / MFA w Outlook.",
                        );
                      } finally {
                        setSendingCode(false);
                      }
                    }}
                  >
                    {sendingCode
                      ? "Wysyłanie…"
                      : cooldownSeconds > 0
                        ? `Wyślij ponownie (${cooldownSeconds}s)`
                        : "Wyślij kod"}
                  </Button>
                </div>
                {codeInfo ? (
                  <p className="text-xs text-white/55">{codeInfo}</p>
                ) : null}
                {errors.emailCode ? (
                  <p className="text-xs text-red-300">{errors.emailCode.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">
                  Hasło
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  ref={(el) => {
                    passwordRef.current = el;
                    passwordRhfRef(el);
                  }}
                  className={cn(inputClass, errors.password && "border-destructive")}
                  {...passwordRegister}
                />
                {errors.password ? (
                  <p className="text-xs text-red-300">{errors.password.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-white/[0.08] bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
              <p className="metallic-text text-xs font-semibold uppercase tracking-[0.2em]">
                Parametry ciała
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="weightKg" className="text-white/80">
                    Waga (kg)
                  </Label>
                  <Input
                    id="weightKg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={30}
                    max={400}
                    className={cn(inputClass, errors.weightKg && "border-destructive")}
                    {...register("weightKg")}
                  />
                  {errors.weightKg ? (
                    <p className="text-xs text-red-300">{errors.weightKg.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heightCm" className="text-white/80">
                    Wzrost (cm)
                  </Label>
                  <Input
                    id="heightCm"
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={100}
                    max={250}
                    className={cn(inputClass, errors.heightCm && "border-destructive")}
                    {...register("heightCm")}
                  />
                  {errors.heightCm ? (
                    <p className="text-xs text-red-300">{errors.heightCm.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-white/80">
                    Wiek
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    min={13}
                    max={120}
                    className={cn(inputClass, errors.age && "border-destructive")}
                    {...register("age")}
                  />
                  {errors.age ? (
                    <p className="text-xs text-red-300">{errors.age.message}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-white/[0.08] bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
              <p className="metallic-text text-xs font-semibold uppercase tracking-[0.2em]">
                Poziom aktywności
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {activityLevels.map((level) => {
                  const active = activityLevel === level;
                  const { label, hint } = activityCopy[level];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setValue("activityLevel", level, { shouldValidate: true })}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-all",
                        active
                          ? "border-[var(--neon)]/60 bg-[var(--neon)]/15 shadow-[0_0_24px_rgba(255,45,85,0.22)]"
                          : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-black/40",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          active ? "text-white" : "text-white/85",
                        )}
                      >
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs text-white/45">{hint}</span>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" {...register("activityLevel")} />
              {errors.activityLevel ? (
                <p className="text-xs text-red-300">{errors.activityLevel.message}</p>
              ) : null}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full bg-[var(--neon)] text-base font-semibold text-white shadow-[0_0_32px_rgba(255,45,85,0.25)] hover:bg-[#ff4d6d]"
            >
              {isSubmitting ? "Tworzenie profilu…" : "Utwórz konto i trenuj"}
            </Button>
            <p className="text-center text-sm text-white/55">
              Masz już konto?{" "}
              <Link
                href="/login?role=zawodnik"
                className="text-[var(--neon)] hover:underline"
              >
                Zaloguj się
              </Link>
            </p>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

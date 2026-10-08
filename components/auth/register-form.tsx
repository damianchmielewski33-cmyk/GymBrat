"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ChevronLeft, Mail } from "lucide-react";
import { registerUser, sendRegisterCode, type RegisterState } from "@/actions/auth";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import {
  FacebookSignInButton,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineBanner } from "@/components/ui/inline-banner";
import { cn } from "@/lib/utils";
import {
  activityLevels,
  registerSchema,
  registerStepFields,
  type RegisterFormValues,
} from "@/lib/validations/register";

const easeOut = [0.22, 1, 0.36, 1] as const;

const activityCopy: Record<
  (typeof activityLevels)[number],
  { label: string; hint: string }
> = {
  low: { label: "Niska", hint: "Biurko, lekkie spacery" },
  medium: { label: "Średnia", hint: "3–5 treningów / tydzień" },
  high: { label: "Wysoka", hint: "Codziennie lub bardzo intensywnie" },
};

type StepId =
  | "welcome"
  | "name"
  | "email"
  | "password"
  | "body"
  | "activity"
  | "goal";

const STEPS: StepId[] = [
  "welcome",
  "name",
  "email",
  "password",
  "body",
  "activity",
  "goal",
];

const STEP_COPY: Record<
  StepId,
  { kicker: string; title: string; support: string }
> = {
  welcome: {
    kicker: "Krok 1",
    title: "Dołącz do GymBrat",
    support: "Wybierz sposób rejestracji — Google, e-mail albo Facebook.",
  },
  name: {
    kicker: "Krok 2",
    title: "Jak masz na imię?",
    support: "Tak będziemy Cię witać na Pulpicie i w profilu.",
  },
  email: {
    kicker: "Krok 3",
    title: "Twój e-mail",
    support: "Wyślemy krótki kod, żeby potwierdzić adres.",
  },
  password: {
    kicker: "Krok 4",
    title: "Ustaw hasło",
    support: "Minimum 8 znaków — do logowania e-mailem.",
  },
  body: {
    kicker: "Krok 5",
    title: "Parametry ciała",
    support: "Potrzebne do Pulpitu, diety (g/kg) i podpowiedzi treningowych.",
  },
  activity: {
    kicker: "Krok 6",
    title: "Aktywność na co dzień",
    support: "Pomaga dopasować obciążenie i szacunki regeneracji.",
  },
  goal: {
    kicker: "Krok 7",
    title: "Cel na tydzień",
    support: "Ile dni w tygodniu chcesz trenować? Zobaczysz to w Postępach.",
  },
};

export function RegisterForm({
  googleEnabled = false,
  facebookEnabled = false,
}: {
  googleEnabled?: boolean;
  facebookEnabled?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex]!;
  const [rootError, setRootError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const passwordRef = useRef<HTMLInputElement | null>(null);

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
      weeklySessionsTarget: 4,
      role: "zawodnik",
    },
    mode: "onSubmit",
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  const activityLevel = watch("activityLevel");
  const emailValue = watch("email");
  const emailCodeValue = watch("emailCode");
  const weeklySessionsTarget = Number(watch("weeklySessionsTarget") || 4);
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
    if (digits.length === 6 && step === "email") {
      queueMicrotask(() => passwordRef.current?.focus());
    }
  }, [emailCodeValue, setValue, step]);

  const copy = STEP_COPY[step];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  async function goNext() {
    setRootError(null);
    if (step === "welcome") {
      setDirection(1);
      setStepIndex(1);
      return;
    }
    const fields = registerStepFields[step as keyof typeof registerStepFields];
    if (fields) {
      const ok = await trigger([...fields]);
      if (!ok) return;
    }
    if (stepIndex >= STEPS.length - 1) {
      await handleSubmit(onSubmit)();
      return;
    }
    setDirection(1);
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function goBack() {
    setRootError(null);
    if (stepIndex <= 0) return;
    setDirection(-1);
    setStepIndex((i) => Math.max(0, i - 1));
  }

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
        const fieldKeys = Object.keys(result.fieldErrors) as (keyof RegisterFormValues)[];
        const jump = STEPS.findIndex((s) => {
          if (s === "welcome") return false;
          const f = registerStepFields[s as keyof typeof registerStepFields];
          return f?.some((name) => fieldKeys.includes(name));
        });
        if (jump >= 0) {
          setDirection(-1);
          setStepIndex(jump);
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
        "Konto utworzone, ale automatyczne logowanie nie wyszło. Zaloguj się ręcznie.",
      );
      return;
    }
    if (!sign?.ok || sign.error) {
      setRootError(
        "Konto utworzone, ale automatyczne logowanie nie wyszło. Zaloguj się ręcznie.",
      );
      return;
    }
    window.location.assign(`${window.location.origin}/start-workout`);
  }

  const { ref: passwordRhfRef, ...passwordRegister } = register("password");

  const primaryLabel =
    step === "goal"
      ? isSubmitting
        ? "Tworzenie konta…"
        : "Utwórz konto"
      : "Dalej";

  return (
    <div className="space-y-5">
      <AuthHeroBrand
        headline={copy.title}
        support={copy.support}
        compact={step !== "welcome"}
      />

      <div className="glass-panel gold-panel relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/12 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-[var(--neon)]/8 blur-3xl"
        />

        <div className="relative space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {copy.kicker} · {stepIndex + 1}/{STEPS.length}
              </p>
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  Wstecz
                </button>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-[var(--gym-gold)]"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35, ease: easeOut }}
              />
            </div>
          </div>

          {rootError ? (
            <InlineBanner role="alert" variant="error">
              {rootError}
            </InlineBanner>
          ) : null}

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -18 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="space-y-5"
            >
              {step === "welcome" ? (
                <div className="space-y-3">
                  <GoogleSignInButton
                    callbackUrl="/complete-profile"
                    label="Zarejestruj się przez Google"
                    disabled={!googleEnabled}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full gap-2.5 border-white/18 bg-white/[0.04] text-[15px] font-semibold text-white hover:border-white/28 hover:bg-white/[0.07]"
                    onClick={() => void goNext()}
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Mail className="h-3.5 w-3.5 text-white/80" aria-hidden />
                    </span>
                    Zarejestruj się przez e-mail
                  </Button>
                  <FacebookSignInButton
                    callbackUrl="/complete-profile"
                    label="Zarejestruj się przez Facebook"
                    disabled={!facebookEnabled}
                  />
                  {!googleEnabled || !facebookEnabled ? (
                    <p className="text-center text-[11px] leading-relaxed text-white/40">
                      {!googleEnabled && !facebookEnabled
                        ? "Google i Facebook będą dostępne po konfiguracji na serwerze — e-mail działa od razu."
                        : !googleEnabled
                          ? "Google będzie dostępne po konfiguracji na serwerze."
                          : "Facebook będzie dostępny po konfiguracji na serwerze."}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {step === "name" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Imię</Label>
                    <Input
                      id="firstName"
                      autoComplete="given-name"
                      autoFocus
                      aria-invalid={errors.firstName ? true : undefined}
                      className={cn(errors.firstName && "border-destructive")}
                      {...register("firstName")}
                    />
                    {errors.firstName ? (
                      <p className="text-xs text-red-100">
                        {errors.firstName.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nazwisko</Label>
                    <Input
                      id="lastName"
                      autoComplete="family-name"
                      aria-invalid={errors.lastName ? true : undefined}
                      className={cn(errors.lastName && "border-destructive")}
                      {...register("lastName")}
                    />
                    {errors.lastName ? (
                      <p className="text-xs text-red-100">
                        {errors.lastName.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === "email" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      aria-invalid={errors.email ? true : undefined}
                      className={cn(errors.email && "border-destructive")}
                      {...register("email")}
                    />
                    {errors.email ? (
                      <p className="text-xs text-red-100">
                        {errors.email.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor="emailCode">Kod z e-maila</Label>
                      <Input
                        id="emailCode"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6 cyfr"
                        aria-invalid={errors.emailCode ? true : undefined}
                        className={cn(errors.emailCode && "border-destructive")}
                        {...register("emailCode")}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={
                        sendingCode || !emailValue?.trim() || cooldownSeconds > 0
                      }
                      className="h-11 shrink-0 bg-white/10 text-white hover:bg-white/15"
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
                          setCodeInfo(
                            "Kod wysłany. Sprawdź skrzynkę (także SPAM).",
                          );
                          setCooldownUntil(Date.now() + 60_000);
                        } catch {
                          setRootError(
                            "Nie udało się wysłać kodu. Spróbuj ponownie za chwilę.",
                          );
                        } finally {
                          setSendingCode(false);
                        }
                      }}
                    >
                      {sendingCode
                        ? "Wysyłanie…"
                        : cooldownSeconds > 0
                          ? `${cooldownSeconds}s`
                          : "Wyślij kod"}
                    </Button>
                  </div>
                  {codeInfo ? (
                    <p className="text-xs text-white/65">{codeInfo}</p>
                  ) : null}
                  {errors.emailCode ? (
                    <p className="text-xs text-red-100">
                      {errors.emailCode.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {step === "password" ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Hasło</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    aria-invalid={errors.password ? true : undefined}
                    ref={(el) => {
                      passwordRef.current = el;
                      passwordRhfRef(el);
                    }}
                    className={cn(errors.password && "border-destructive")}
                    {...passwordRegister}
                  />
                  {errors.password ? (
                    <p className="text-xs text-red-100">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {step === "body" ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="weightKg">Waga (kg)</Label>
                    <Input
                      id="weightKg"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={30}
                      max={400}
                      autoFocus
                      aria-invalid={errors.weightKg ? true : undefined}
                      className={cn(errors.weightKg && "border-destructive")}
                      {...register("weightKg")}
                    />
                    {errors.weightKg ? (
                      <p className="text-xs text-red-100">
                        {errors.weightKg.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heightCm">Wzrost (cm)</Label>
                    <Input
                      id="heightCm"
                      type="number"
                      inputMode="numeric"
                      min={100}
                      max={250}
                      aria-invalid={errors.heightCm ? true : undefined}
                      className={cn(errors.heightCm && "border-destructive")}
                      {...register("heightCm")}
                    />
                    {errors.heightCm ? (
                      <p className="text-xs text-red-100">
                        {errors.heightCm.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Wiek</Label>
                    <Input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min={13}
                      max={120}
                      aria-invalid={errors.age ? true : undefined}
                      className={cn(errors.age && "border-destructive")}
                      {...register("age")}
                    />
                    {errors.age ? (
                      <p className="text-xs text-red-100">
                        {errors.age.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === "activity" ? (
                <div className="space-y-3">
                  <div
                    className="grid gap-2"
                    role="radiogroup"
                    aria-label="Poziom aktywności"
                  >
                    {activityLevels.map((level) => {
                      const active = activityLevel === level;
                      const { label, hint } = activityCopy[level];
                      return (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() =>
                            setValue("activityLevel", level, {
                              shouldValidate: true,
                            })
                          }
                          className={cn(
                            "rounded-2xl border px-4 py-3.5 text-left transition",
                            active
                              ? "border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.12)]"
                              : "border-white/12 bg-black/30 hover:border-white/20",
                          )}
                        >
                          <span className="block text-[15px] font-semibold text-white">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-white/50">
                            {hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" {...register("activityLevel")} />
                  {errors.activityLevel ? (
                    <p className="text-xs text-red-100">
                      {errors.activityLevel.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {step === "goal" ? (
                <div className="space-y-4">
                  <p className="text-center font-metric text-5xl tabular-nums text-[var(--gym-gold)]">
                    {weeklySessionsTarget}
                  </p>
                  <p className="text-center text-sm text-white/50">
                    {weeklySessionsTarget === 1
                      ? "dzień treningowy / tydzień"
                      : weeklySessionsTarget >= 2 && weeklySessionsTarget <= 4
                        ? "dni treningowe / tydzień"
                        : "dni treningowych / tydzień"}
                  </p>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    step={1}
                    value={weeklySessionsTarget}
                    onChange={(e) =>
                      setValue("weeklySessionsTarget", Number(e.target.value), {
                        shouldValidate: true,
                      })
                    }
                    className="w-full accent-[var(--gym-gold)]"
                    aria-label="Dni treningowe w tygodniu"
                  />
                  <div className="flex justify-between text-[11px] text-white/35">
                    <span>1</span>
                    <span>7</span>
                  </div>
                  <input type="hidden" {...register("weeklySessionsTarget")} />
                  {errors.weeklySessionsTarget ? (
                    <p className="text-xs text-red-100">
                      {errors.weeklySessionsTarget.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <input type="hidden" {...register("role")} />

          {step !== "welcome" ? (
            <Button
              type="button"
              variant="cta"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              onClick={() => void goNext()}
            >
              {primaryLabel}
            </Button>
          ) : null}

          <p className="text-center text-sm text-white/55">
            Masz już konto?{" "}
            <Link
              href="/login"
              className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              Zaloguj się
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

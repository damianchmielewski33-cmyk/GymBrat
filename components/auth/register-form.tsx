"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ChevronLeft,
  FlaskConical,
  Mail,
  MailX,
  ShieldCheck,
  UserX,
  X,
} from "lucide-react";
import {
  registerUser,
  sendRegisterCode,
  type RegisterErrorCode,
  type RegisterState,
} from "@/actions/auth";
import { updateBodyParams } from "@/actions/profile";
import {
  OFFLINE_REGISTER_MESSAGE,
  registerWelcomeCopy,
} from "@/components/auth/auth-copy";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import {
  FacebookSignInButton,
  GoogleSignInButton,
} from "@/components/auth/google-sign-in-button";
import { OAuthPrivacyNote } from "@/components/auth/oauth-privacy-note";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineBanner } from "@/components/ui/inline-banner";
import { plural } from "@/lib/progress-format";
import type { RegistrationAvailability } from "@/lib/register-email-mode";
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

/** Błędy kodu pokazujemy przy polu kodu na kroku „email”. */
const CODE_ERROR_CODES: ReadonlySet<RegisterErrorCode> = new Set([
  "code_missing",
  "code_expired",
  "code_invalid",
  "code_attempts_exhausted",
]);

const RESEND_COOLDOWN_SECONDS = 60;

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Kroki po Google/Facebook — bez welcome / e-mail / hasła. */
const OAUTH_STEPS: StepId[] = ["name", "body", "activity", "goal"];

const STEP_COPY: Record<
  StepId,
  { kicker: string; title: string; support: string }
> = {
  welcome: {
    kicker: "Krok 1",
    title: "Dołącz do GymBrat",
    // Zależy od dostępnych metod — patrz `registerWelcomeCopy`.
    support: "",
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
  availability,
  emailTestCode = null,
  oauthContinue = false,
  oauthPrefill = null,
  accountResetNotice = false,
}: {
  /** Dostępne metody rejestracji — liczone na serwerze. */
  availability: RegistrationAvailability;
  /** Kod trybu testowego (tylko dev/test bez SMTP); na produkcji zawsze `null`. */
  emailTestCode?: string | null;
  /** Po Google/Facebook — kontynuacja wizarda rejestracji (nie Pulpit). */
  oauthContinue?: boolean;
  oauthPrefill?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  /** Jednorazowy komunikat po zabezpieczeniu konta (UX 4B, `notice=account_reset`). */
  accountResetNotice?: boolean;
}) {
  const router = useRouter();
  const { update: updateSession, status: sessionStatus } = useSession();
  const steps = oauthContinue ? OAUTH_STEPS : STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex]!;
  const [rootError, setRootError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const focusProviderOnWelcome = useRef(false);
  /** Odmowa serwera `registration_disabled` w trakcie rejestracji (UX 1F). */
  const [emailBlockedMessage, setEmailBlockedMessage] = useState<string | null>(null);
  const emailBlocked = emailBlockedMessage !== null;
  const [showResetNotice, setShowResetNotice] = useState(accountResetNotice);
  const googleEnabled = availability.google;
  const facebookEnabled = availability.facebook;
  const emailEnabled = availability.emailMode !== "disabled" && !emailBlocked;
  const emailTestMode = availability.emailMode === "test" && Boolean(emailTestCode);
  const welcome = registerWelcomeCopy({
    email: emailEnabled,
    google: googleEnabled,
    facebook: facebookEnabled,
  });
  const registrationClosed = step === "welcome" && welcome.kind === "closed";

  // Komunikat 4B jest jednorazowy: usuwamy `notice` z adresu (odświeżenie go nie powtórzy).
  useEffect(() => {
    if (!accountResetNotice) return;
    router.replace("/register?oauth=1");
  }, [accountResetNotice, router]);

  // Po „Wróć do wyboru metody” (UX 1F) fokus trafia na pierwszy aktywny przycisk dostawcy.
  // Callback ref, bo krok „welcome” montuje się dopiero po animacji wyjścia poprzedniego.
  const focusFirstProvider = useCallback((el: HTMLDivElement | null) => {
    if (!el || !focusProviderOnWelcome.current) return;
    focusProviderOnWelcome.current = false;
    el.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
  }, []);

  // Po powrocie z Google cookie bywa gotowe później niż pierwszy SSR — odśwież RSC.
  useEffect(() => {
    if (!oauthContinue || oauthPrefill) return;
    if (sessionStatus === "loading") return;
    const t = window.setTimeout(() => router.refresh(), 400);
    return () => window.clearTimeout(t);
  }, [oauthContinue, oauthPrefill, sessionStatus, router]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: oauthPrefill?.firstName ?? "",
      lastName: oauthPrefill?.lastName ?? "",
      email: oauthPrefill?.email ?? "",
      emailCode: oauthContinue ? "000000" : "",
      password: oauthContinue ? "oauth-placeholder-8" : "",
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
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = window.setTimeout(() => setCooldownSeconds((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldownSeconds]);

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

  const copy = oauthContinue
    ? {
        ...STEP_COPY[step],
        kicker:
          step === "name"
            ? "Rejestracja Google"
            : STEP_COPY[step].kicker.replace(/^Krok \d+/, `Krok ${stepIndex + 1}`),
        support:
          step === "name"
            ? "Potwierdź imię i nazwisko z Google, potem parametry ciała — jak przy rejestracji e-mailem."
            : STEP_COPY[step].support,
      }
    : step === "welcome"
      ? {
          ...STEP_COPY.welcome,
          title: welcome.kind === "closed" ? welcome.headline : STEP_COPY.welcome.title,
          support: welcome.support,
        }
      : STEP_COPY[step];
  const progress = ((stepIndex + 1) / steps.length) * 100;

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
    if (stepIndex >= steps.length - 1) {
      await handleSubmit(onSubmit)();
      return;
    }
    setShowResetNotice(false);
    setDirection(1);
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  function goBack() {
    setRootError(null);
    if (stepIndex <= 0) return;
    setDirection(-1);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function jumpBackTo(target: StepId) {
    const index = steps.indexOf(target);
    if (index < 0) return;
    setDirection(-1);
    setStepIndex(index);
  }

  function backToMethodChoice() {
    setRootError(null);
    focusProviderOnWelcome.current = true;
    jumpBackTo("welcome");
  }

  async function onSendCode() {
    setRootError(null);
    setCodeInfo(null);
    const email = (emailValue ?? "").trim().toLowerCase();
    if (!email) {
      setRootError("Wpisz e-mail, aby wysłać kod.");
      return;
    }
    if (isOffline()) {
      setRootError(OFFLINE_REGISTER_MESSAGE);
      return;
    }
    setSendingCode(true);
    try {
      const res = await sendRegisterCode({ email });
      if (!res.ok) {
        if (res.code === "registration_disabled") {
          setEmailBlockedMessage(res.error);
          return;
        }
        setRootError(res.error);
        return;
      }
      // LR-19 / LR-29: „wysłany” tylko po faktycznym nadaniu wiadomości.
      setCodeInfo(
        res.mode === "test"
          ? `Tryb testowy: wiadomość nie została wysłana. Użyj kodu ${emailTestCode ?? ""}.`
          : `Kod wysłany na ${email}. Sprawdź skrzynkę i folder SPAM. Kod jest ważny 10 minut.`,
      );
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } catch {
      setRootError(
        isOffline()
          ? OFFLINE_REGISTER_MESSAGE
          : "Nie udało się wysłać kodu. Spróbuj ponownie za chwilę.",
      );
    } finally {
      setSendingCode(false);
    }
  }

  async function onSubmitOauth(values: RegisterFormValues) {
    setRootError(null);
    const result = await updateBodyParams({
      firstName: values.firstName,
      lastName: values.lastName,
      weightKg: values.weightKg,
      heightCm: values.heightCm,
      age: values.age,
      activityLevel: values.activityLevel,
      weeklySessionsTarget: values.weeklySessionsTarget,
    });
    if (!result.ok) {
      setRootError(result.error);
      return;
    }
    try {
      await updateSession();
    } catch {
      /* hard-nav i tak odświeży JWT */
    }
    window.location.assign(`${window.location.origin}/start-workout`);
  }

  async function onSubmit(values: RegisterFormValues) {
    if (oauthContinue) {
      await onSubmitOauth(values);
      return;
    }

    setRootError(null);
    setCodeInfo(null);
    if (isOffline()) {
      setRootError(OFFLINE_REGISTER_MESSAGE);
      return;
    }
    let result: RegisterState;
    try {
      result = await registerUser(values);
    } catch {
      setRootError(
        isOffline()
          ? OFFLINE_REGISTER_MESSAGE
          : "Nie udało się utworzyć konta. Spróbuj ponownie za chwilę.",
      );
      return;
    }
    if (!result.ok) {
      if (result.code === "registration_disabled") {
        setEmailBlockedMessage(result.error);
        jumpBackTo("email");
        return;
      }
      if (CODE_ERROR_CODES.has(result.code)) {
        setError("emailCode", { message: result.error });
        jumpBackTo("email");
        return;
      }
      if (result.fieldErrors) {
        for (const [key, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) {
            setError(key as keyof RegisterFormValues, {
              message: messages[0],
            });
          }
        }
        const fieldKeys = Object.keys(result.fieldErrors) as (keyof RegisterFormValues)[];
        const jump = steps.findIndex((s) => {
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
        redirectTo: "/start-workout",
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
        ? oauthContinue
          ? "Kończenie rejestracji…"
          : "Tworzenie konta…"
        : oauthContinue
          ? "Dokończ rejestrację"
          : "Utwórz konto"
      : "Dalej";

  if (oauthContinue && !oauthPrefill) {
    return (
      <div className="space-y-5">
        <AuthHeroBrand
          headline="Kończymy logowanie Google…"
          support="Sesja się dogrywa — zaraz wrócisz do rejestracji (imię, parametry ciała)."
        />
        <div className="glass-panel gold-panel p-6 text-center text-sm text-white/65">
          Jeśli nic się nie dzieje,{" "}
          <Link href="/register" className="text-[var(--neon)] underline-offset-4 hover:underline">
            wróć do rejestracji
          </Link>{" "}
          i spróbuj ponownie.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AuthHeroBrand
        headline={
          oauthContinue && step === "name" ? "Dokończ rejestrację" : copy.title
        }
        support={copy.support}
        compact={step !== "welcome"}
      />

      <AuthCard bodyClassName="space-y-5">
        {registrationClosed ? null : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {copy.kicker} · {stepIndex + 1}/{steps.length}
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
        )}

        {step === "email" && emailBlocked ? (
          <div className="space-y-3">
            <InlineBanner role="alert" variant="error">
              {emailBlockedMessage}
            </InlineBanner>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={backToMethodChoice}
            >
              Wróć do wyboru metody
            </Button>
          </div>
        ) : rootError ? (
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
            {step === "welcome" && welcome.kind === "closed" ? (
              <div className="space-y-3">
                <InlineBanner role="status" variant="warning">
                  <span className="flex items-start gap-2">
                    <UserX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      Nie można teraz założyć nowego konta. Logowanie na
                      istniejące konto działa bez zmian.
                    </span>
                  </span>
                </InlineBanner>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "cta" }), "w-full")}
                >
                  Przejdź do logowania
                </Link>
              </div>
            ) : null}

            {step === "welcome" && welcome.kind === "open" ? (
              <div className="space-y-3" ref={focusFirstProvider}>
                {googleEnabled ? (
                  <GoogleSignInButton
                    redirectTo="/register?oauth=1"
                    label="Zarejestruj się przez Google"
                  />
                ) : null}
                {facebookEnabled && !googleEnabled && !emailEnabled ? (
                  <FacebookSignInButton
                    redirectTo="/register?oauth=1"
                    label="Zarejestruj się przez Facebook"
                  />
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={!emailEnabled}
                  aria-describedby={
                    emailEnabled ? undefined : "register-email-unavailable"
                  }
                  className="h-12 w-full gap-2.5 border-white/18 bg-white/[0.04] text-[15px] font-semibold text-white hover:border-white/28 hover:bg-white/[0.07]"
                  onClick={() => void goNext()}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Mail className="h-3.5 w-3.5 text-white/80" aria-hidden />
                  </span>
                  Zarejestruj się przez e-mail
                </Button>
                {facebookEnabled && (googleEnabled || emailEnabled) ? (
                  <FacebookSignInButton
                    redirectTo="/register?oauth=1"
                    label="Zarejestruj się przez Facebook"
                  />
                ) : null}
                {welcome.emailUnavailableProvider ? (
                  <InlineBanner
                    id="register-email-unavailable"
                    role="status"
                    variant="info"
                  >
                    <span className="flex items-start gap-2">
                      <MailX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        Rejestracja e-mailem jest chwilowo niedostępna. Załóż
                        konto przez {welcome.emailUnavailableProvider}. Jeśli
                        masz już konto z hasłem,{" "}
                        <Link
                          href="/login"
                          className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                          zaloguj się
                        </Link>{" "}
                        normalnie.
                      </span>
                    </span>
                  </InlineBanner>
                ) : null}
              </div>
            ) : null}

            {step === "name" && showResetNotice ? (
              <InlineBanner role="status" variant="info">
                <span className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <strong className="block font-semibold">
                      Zabezpieczyliśmy Twój adres
                    </strong>
                    Ten adres był wcześniej użyty bez potwierdzenia.
                    Zabezpieczyliśmy konto: dotychczasowe hasło i dane konta
                    zostały usunięte. Zaczynasz od nowa.
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="touch-target -my-2 -mr-2 shrink-0"
                    aria-label="Zamknij komunikat"
                    onClick={() => setShowResetNotice(false)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </span>
              </InlineBanner>
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
                {emailTestMode ? (
                  <InlineBanner role="status" variant="warning">
                    <span className="flex items-start gap-2">
                      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        <strong className="block font-semibold">Tryb testowy</strong>
                        E-maile nie są wysyłane. Wpisz kod {emailTestCode}.
                      </span>
                    </span>
                  </InlineBanner>
                ) : null}
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
                      placeholder={emailTestMode ? (emailTestCode ?? undefined) : "6 cyfr"}
                      aria-invalid={errors.emailCode ? true : undefined}
                      aria-describedby={
                        errors.emailCode ? "emailCode-error" : undefined
                      }
                      className={cn(errors.emailCode && "border-destructive")}
                      {...register("emailCode")}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={
                      emailBlocked ||
                      sendingCode ||
                      !emailValue?.trim() ||
                      cooldownSeconds > 0
                    }
                    aria-busy={sendingCode}
                    aria-label={
                      cooldownSeconds > 0
                        ? `Wyślij kod ponownie za ${cooldownSeconds} ${plural(cooldownSeconds, "sekundę", "sekundy", "sekund")}`
                        : undefined
                    }
                    className="h-11 shrink-0 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => void onSendCode()}
                  >
                    {sendingCode
                      ? "Wysyłanie…"
                      : cooldownSeconds > 0
                        ? `Wyślij ponownie (${cooldownSeconds} s)`
                        : "Wyślij kod"}
                  </Button>
                </div>
                {codeInfo ? (
                  <p role="status" className="text-[13px] leading-relaxed text-white/65">
                    {codeInfo}
                  </p>
                ) : null}
                {errors.emailCode ? (
                  <p id="emailCode-error" className="text-xs text-red-100">
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

        {oauthContinue && oauthPrefill?.email ? (
          <p className="text-center text-xs text-white/45">
            Rejestracja:{" "}
            <span className="font-medium text-white/75">
              {oauthPrefill.email}
            </span>
          </p>
        ) : null}

        {registrationClosed ? null : (
          <p className="text-center text-sm text-white/55">
            Masz już konto?{" "}
            <Link
              href="/login"
              className="rounded-sm text-[var(--neon)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              Zaloguj się
            </Link>
          </p>
        )}
        {step === "welcome" && (googleEnabled || facebookEnabled) ? (
          <OAuthPrivacyNote />
        ) : null}
        <p className="text-center text-[11px] text-white/35">
          Rejestrując się, akceptujesz{" "}
          <Link href="/regulamin" className="underline-offset-2 hover:underline">
            Regulamin
          </Link>{" "}
          i{" "}
          <Link
            href="/polityka-prywatnosci"
            className="underline-offset-2 hover:underline"
          >
            Politykę prywatności
          </Link>
          .
        </p>
      </AuthCard>
    </div>
  );
}

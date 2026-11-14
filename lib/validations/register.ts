import { z } from "zod";
import { MIN_AGE_MESSAGE, MIN_USER_AGE } from "@/lib/min-age";

export const activityLevels = ["low", "medium", "high"] as const;

/** Obwód w cm: puste pole = brak wartości (pomiar opcjonalny). */
const optionalCm = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number(`Wpisz ${label} w cm`)
      .min(20, "Minimum 20 cm")
      .max(250, "Maksimum 250 cm")
      .optional(),
  );

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "Imię jest wymagane")
      .max(80, "Za długie"),
    lastName: z
      .string()
      .trim()
      .min(1, "Nazwisko jest wymagane")
      .max(80, "Za długie"),
    email: z.string().trim().email("Wpisz poprawny adres e-mail"),
    password: z
      .string()
      .min(8, "Użyj minimum 8 znaków")
      .max(128, "Hasło jest za długie"),
    confirmPassword: z.string().min(1, "Powtórz hasło"),
    weightKg: z.coerce
      .number("Wpisz swoją wagę")
      .min(30, "Minimum 30 kg")
      .max(400, "Maksimum 400 kg"),
    heightCm: z.coerce
      .number("Wpisz swój wzrost")
      .int("Użyj pełnych centymetrów")
      .min(100, "Minimum 100 cm")
      .max(250, "Maksimum 250 cm"),
    age: z.coerce
      .number("Wpisz swój wiek")
      .int("Użyj liczby całkowitej")
      .min(MIN_USER_AGE, MIN_AGE_MESSAGE)
      .max(120, "Maksymalny wiek: 120"),
    /** Opcjonalne obwody startowe — trafiają do pierwszego raportu sylwetki (wymagają zgody `health`). */
    abdomenCm: optionalCm("obwód brzucha"),
    chestCm: optionalCm("obwód klatki"),
    armCm: optionalCm("obwód ramienia"),
    activityLevel: z.enum(activityLevels, {
      message: "Wybierz poziom aktywności",
    }),
    /** Cel treningów / tydzień — Postępy, onboarding, hub Trening. */
    weeklySessionsTarget: z.coerce
      .number("Podaj liczbę dni")
      .int("Użyj liczby całkowitej")
      .min(1, "Minimum 1 dzień")
      .max(7, "Maksimum 7 dni"),
    /** Rejestracja zawsze jako zawodnik (rola „trener” usunięta, Z77). */
    role: z.literal("zawodnik"),
    /** Opcjonalne zgody z ekranu rejestracji (Z11); brak = brak zgody, można dać później. */
    healthConsent: z.boolean().optional(),
    photosConsent: z.boolean().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Hasła nie są takie same",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormValues = z.input<typeof registerSchema>;

/** Pola walidowane na poszczególnych krokach wizarda. */
export const registerStepFields = {
  body: ["weightKg", "heightCm", "age", "abdomenCm", "chestCm", "armCm"],
  activity: ["activityLevel"],
  goal: ["weeklySessionsTarget"],
  photo: [],
  name: ["firstName", "lastName"],
  email: ["email"],
  password: ["password", "confirmPassword"],
} as const satisfies Record<string, readonly (keyof RegisterFormValues)[]>;

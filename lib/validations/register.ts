import { z } from "zod";

export const activityLevels = ["low", "medium", "high"] as const;

export const registerSchema = z.object({
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
    .min(13, "Minimalny wiek: 13")
    .max(120, "Maksymalny wiek: 120"),
  activityLevel: z.enum(activityLevels, {
    message: "Wybierz poziom aktywności",
  }),
  /** Na razie rejestracja tylko jako zawodnik (trener — w przyszłości). */
  role: z.literal("zawodnik"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormValues = z.input<typeof registerSchema>;

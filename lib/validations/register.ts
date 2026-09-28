import { z } from "zod";

export const activityLevels = ["low", "medium", "high"] as const;

const requiredCm = z.coerce
  .number("Wpisz pomiar w cm")
  .min(20, "Minimum 20 cm")
  .max(300, "Maksimum 300 cm");

const optionalPhoto = z.preprocess((v) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}, z
  .string()
  .max(2_800_000, "Zdjęcie jest za duże — wybierz mniejsze lub zrób zdjęcie ponownie")
  .refine(
    (s) => s.startsWith("data:image/"),
    "Nieprawidłowy format zdjęcia",
  )
  .optional());

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
  emailCode: z
    .string()
    .trim()
    // Tymczasowo dopuszczamy 4 cyfry dla trybu mock (np. "1234"),
    // ale backend i tak egzekwuje poprawność kodu.
    .regex(/^(?:\d{4}|\d{6})$/, "Wpisz kod z e-maila (4 lub 6 cyfr)"),
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
  /** Obwody — ten sam zestaw co w raporcie sylwetki (punkt startowy). */
  waistCm: requiredCm,
  chestCm: requiredCm,
  thighCm: requiredCm,
  armCm: requiredCm,
  abdomenCm: requiredCm,
  /** Opcjonalne zdjęcie startowe (data URL JPEG/PNG, kompresja po stronie klienta). */
  startPhotoDataUrl: optionalPhoto,
  activityLevel: z.enum(activityLevels, {
    message: "Wybierz poziom aktywności",
  }),
  /** Na razie rejestracja tylko jako zawodnik (trener — w przyszłości). */
  role: z.literal("zawodnik"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormValues = z.input<typeof registerSchema>;

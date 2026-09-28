import { z } from "zod";

export const activityLevels = ["low", "medium", "high"] as const;

function requiredNumberField(opts: {
  emptyMessage: string;
  min: number;
  max: number;
  minMessage: string;
  maxMessage: string;
  int?: boolean;
}) {
  return z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      if (v === "" || v == null) {
        ctx.addIssue({ code: "custom", message: opts.emptyMessage });
        return z.NEVER;
      }
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: opts.emptyMessage });
        return z.NEVER;
      }
      return n;
    })
    .pipe(
      opts.int
        ? z
            .number()
            .int("Użyj liczby całkowitej")
            .min(opts.min, opts.minMessage)
            .max(opts.max, opts.maxMessage)
        : z.number().min(opts.min, opts.minMessage).max(opts.max, opts.maxMessage),
    );
}

const requiredCm = requiredNumberField({
  emptyMessage: "Wpisz pomiar w cm",
  min: 20,
  max: 300,
  minMessage: "Minimum 20 cm",
  maxMessage: "Maksimum 300 cm",
});

const optionalPhoto = z
  .union([z.string(), z.undefined()])
  .optional()
  .transform((s) => {
    const t = (s ?? "").trim();
    return t.length ? t : undefined;
  })
  .superRefine((s, ctx) => {
    if (s == null) return;
    if (!s.startsWith("data:image/")) {
      ctx.addIssue({ code: "custom", message: "Nieprawidłowy format zdjęcia" });
    }
    if (s.length > 2_800_000) {
      ctx.addIssue({
        code: "custom",
        message: "Zdjęcie jest za duże — wybierz mniejsze lub zrób zdjęcie ponownie",
      });
    }
  });

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
  weightKg: requiredNumberField({
    emptyMessage: "Wpisz swoją wagę",
    min: 30,
    max: 400,
    minMessage: "Minimum 30 kg",
    maxMessage: "Maksimum 400 kg",
  }),
  heightCm: requiredNumberField({
    emptyMessage: "Wpisz swój wzrost",
    min: 100,
    max: 250,
    minMessage: "Minimum 100 cm",
    maxMessage: "Maksimum 250 cm",
    int: true,
  }),
  age: requiredNumberField({
    emptyMessage: "Wpisz swój wiek",
    min: 13,
    max: 120,
    minMessage: "Minimalny wiek: 13",
    maxMessage: "Maksymalny wiek: 120",
    int: true,
  }),
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

/** Wartości po walidacji (serwer / onSubmit). */
export type RegisterInput = z.output<typeof registerSchema>;

/** Wartości formularza (stringi w polach liczbowych). */
export type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  emailCode: string;
  password: string;
  weightKg: string;
  heightCm: string;
  age: string;
  waistCm: string;
  chestCm: string;
  thighCm: string;
  armCm: string;
  abdomenCm: string;
  startPhotoDataUrl?: string;
  activityLevel: (typeof activityLevels)[number];
  role: "zawodnik";
};

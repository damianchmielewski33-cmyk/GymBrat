import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Wpisz poprawny adres e-mail"),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email("Wpisz poprawny adres e-mail"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Wpisz 6-cyfrowy kod z e-maila"),
  // Te same granice co w rejestracji (`registerSchema.password`).
  password: z
    .string()
    .min(8, "Użyj minimum 8 znaków")
    .max(128, "Hasło jest za długie"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

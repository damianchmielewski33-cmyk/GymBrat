import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-mail jest wymagany")
    .email("Wpisz poprawny adres e-mail"),
  password: z.string().min(1, "Hasło jest wymagane"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginFormValues = z.input<typeof loginSchema>;

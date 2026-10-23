"use server";

import { z } from "zod";
import { guardAction } from "@/lib/action-guard";
import {
  isTakeoverPending,
  takeOverUnverifiedAccount,
  verifyTakeoverToken,
} from "@/lib/account-takeover";
import { logAuthFailure } from "@/lib/security-events";

/**
 * Ekran „Zabezpiecz adres e-mail” (ADR 0001 D4, UX 4A). Po `ok: true` klient woła
 * `signIn("google", { callbackUrl: "/register?oauth=1&notice=account_reset" })`.
 */
export type ConfirmTakeoverState =
  | { ok: true }
  | { ok: false; code: "expired" | "failed"; error: string };

const tokenSchema = z.object({ token: z.string().min(1).max(2048) });

const EXPIRED: ConfirmTakeoverState = {
  ok: false,
  code: "expired",
  error: "Ten link wygasł. Zaloguj się ponownie przez Google.",
};

const FAILED: ConfirmTakeoverState = {
  ok: false,
  code: "failed",
  error: "Nie udało się zabezpieczyć konta. Niczego nie zmieniliśmy. Spróbuj ponownie.",
};

/** Dla RSC strony: czy token jest ważny i konto nadal czeka na przejęcie (bez danych konta). */
export async function readTakeoverToken(token: string): Promise<{ valid: boolean }> {
  await guardAction("auth.readTakeoverToken");
  const parsed = tokenSchema.safeParse({ token });
  if (!parsed.success) return { valid: false };
  const payload = verifyTakeoverToken(parsed.data.token);
  if (!payload) return { valid: false };
  try {
    return { valid: await isTakeoverPending(payload) };
  } catch (err) {
    logAuthFailure("auth.readTakeoverToken", err);
    return { valid: false };
  }
}

export async function confirmAccountTakeover(input: unknown): Promise<ConfirmTakeoverState> {
  await guardAction("auth.confirmAccountTakeover", { limit: 10, windowMs: 3_600_000 });
  const parsed = tokenSchema.safeParse(input);
  if (!parsed.success) return EXPIRED;
  const payload = verifyTakeoverToken(parsed.data.token);
  if (!payload) return EXPIRED;
  try {
    const takenOver = await takeOverUnverifiedAccount({
      userId: payload.uid,
      providerAccountId: payload.pid,
    });
    return takenOver ? { ok: true } : EXPIRED;
  } catch (err) {
    // Batch jest jedną transakcją: błąd = nic nie zmienione (US-5).
    logAuthFailure("auth.confirmAccountTakeover", err);
    return FAILED;
  }
}

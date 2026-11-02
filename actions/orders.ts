"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import { issueReceipt } from "@/lib/receipts";
import { isValidNip, normalizeNip } from "@/lib/tax-id";

const buyerSchema = z.object({
  orderId: z.string().min(1).max(64),
  buyerName: z.string().trim().max(120).optional(),
  buyerTaxId: z.string().trim().max(20).optional(),
});

/** Z21: wystawia potwierdzenie zakupu (numer GB/RRRR/NNNNNN); nazwa i NIP nabywcy są opcjonalne. */
export async function issueReceiptAction(input: unknown) {
  await guardAction("orders.issueReceiptAction");
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const parsed = buyerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe dane." };

  const name = parsed.data.buyerName || null;
  const rawNip = parsed.data.buyerTaxId || null;
  if (rawNip && !isValidNip(rawNip)) {
    return { ok: false as const, error: "Nieprawidłowy NIP." };
  }
  if (rawNip && !name) {
    return { ok: false as const, error: "Podaj nazwę nabywcy razem z NIP." };
  }

  const res = await issueReceipt(session.user.id, parsed.data.orderId, {
    name,
    taxId: rawNip ? normalizeNip(rawNip) : null,
  });
  if (!res.ok) {
    return {
      ok: false as const,
      error:
        res.reason === "not_paid"
          ? "Potwierdzenie można wystawić tylko dla opłaconego zamówienia."
          : "Nie udało się wystawić potwierdzenia.",
    };
  }
  revalidatePath("/package/orders");
  revalidatePath(`/package/receipt/${parsed.data.orderId}`);
  return { ok: true as const, number: res.receipt.number };
}

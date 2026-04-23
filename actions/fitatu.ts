"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { fitatuTag } from "@/lib/cache-tags";
import { encryptSensitiveField } from "@/lib/app-field-crypto";

export type FitatuFormState = {
  error?: string;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const tokenSchema = z.object({
  token: z.string().trim().min(8).max(8192),
});

function fitatuBaseUrl() {
  return process.env.FITATU_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

function revalidateFitatu(userId: string) {
  revalidateTag(fitatuTag(userId), "max");
  revalidatePath("/");
  revalidatePath("/profile");
}

export async function refreshFitatuMacros() {
  const session = await auth();
  if (!session?.user?.id) return;
  revalidateFitatu(session.user.id);
}

export async function connectFitatuLoginAction(
  _prev: FitatuFormState,
  formData: FormData,
): Promise<FitatuFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Podaj poprawny email i hasło Fitatu." };
  }

  const base = fitatuBaseUrl();
  if (!base) {
    return {
      error:
        "Brak FITATU_API_BASE_URL — skonfiguruj proxy z endpointem POST /auth/login (patrz README).",
    };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: parsed.data.email,
        password: parsed.data.password,
      }),
    });
  } catch {
    return { error: "Nie udało się połączyć z serwerem proxy Fitatu." };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { error: "Proxy zwróciło nieprawidłową odpowiedź." };
  }

  const token =
    typeof body === "object" &&
    body !== null &&
    ("accessToken" in body || "token" in body)
      ? String(
          (body as { accessToken?: unknown; token?: unknown }).accessToken ??
            (body as { token?: unknown }).token ??
            "",
        )
      : "";

  if (!res.ok || !token) {
    return {
      error:
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
          ? (body as { message: string }).message
          : "Logowanie nie powiodło się — sprawdź dane lub konfigurację proxy.",
    };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ fitatuAccessToken: encryptSensitiveField(token) })
    .where(eq(users.id, session.user.id));

  revalidateFitatu(session.user.id);
  redirect("/profile");
}

export async function saveFitatuTokenAction(
  _prev: FitatuFormState,
  formData: FormData,
): Promise<FitatuFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = tokenSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) {
    return { error: "Token musi mieć co najmniej 8 znaków." };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ fitatuAccessToken: encryptSensitiveField(parsed.data.token) })
    .where(eq(users.id, session.user.id));

  revalidateFitatu(session.user.id);
  redirect("/profile");
}

export async function disconnectFitatuAction() {
  const session = await auth();
  if (!session?.user?.id) return;

  const db = getDb();
  await db
    .update(users)
    .set({ fitatuAccessToken: null })
    .where(eq(users.id, session.user.id));

  revalidateFitatu(session.user.id);
  redirect("/profile");
}

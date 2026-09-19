import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { getAwpOrigin } from "@/lib/awp-origin";

export type AwpAccountProfile = {
  awpUserId: number;
  firstName: string;
  lastName: string;
  zawodnik: string;
  email: string | null;
  isAdmin: boolean;
};

export type AwpLoginPinInput = {
  firstName: string;
  lastName: string;
  pin: string;
};

export type AwpLoginEmailInput = {
  email: string;
  password: string;
};

type AwpLoginJson = {
  ok?: boolean;
  token?: string;
  error?: string;
  user?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    zawodnik?: string;
    is_admin?: number;
  };
};

type AwpMeJson = {
  user?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    zawodnik?: string;
    is_admin?: number;
    email?: string | null;
  } | null;
};

function syntheticAwpEmail(awpUserId: number): string {
  return `awp-${awpUserId}@users.gymbrat.local`;
}

function displayName(firstName: string, lastName: string, zawodnik: string): string {
  const full = `${firstName} ${lastName}`.trim();
  return full || zawodnik || "Zawodnik";
}

async function fetchAwpJson(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const url = `${getAwpOrigin()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

function profileFromLogin(
  body: AwpLoginJson,
  emailHint?: string | null,
): AwpAccountProfile | null {
  const u = body.user;
  if (!body.ok || !u || typeof u.id !== "number" || u.id <= 0) return null;
  return {
    awpUserId: u.id,
    firstName: String(u.first_name ?? "").trim(),
    lastName: String(u.last_name ?? "").trim(),
    zawodnik: String(u.zawodnik ?? "").trim(),
    email: emailHint?.trim().toLowerCase() || null,
    isAdmin: u.is_admin === 1,
  };
}

function profileFromMe(body: AwpMeJson): AwpAccountProfile | null {
  const u = body.user;
  if (!u || typeof u.id !== "number" || u.id <= 0) return null;
  const emailRaw = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
  return {
    awpUserId: u.id,
    firstName: String(u.first_name ?? "").trim(),
    lastName: String(u.last_name ?? "").trim(),
    zawodnik: String(u.zawodnik ?? "").trim(),
    email: emailRaw || null,
    isAdmin: u.is_admin === 1,
  };
}

/** Logowanie PIN-em jak w Akademii (imię + nazwisko + PIN). */
export async function loginAwpWithPin(
  input: AwpLoginPinInput,
): Promise<
  | { ok: true; token: string; profile: AwpAccountProfile }
  | { ok: false; error: string }
> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const pin = input.pin.trim();
  if (!firstName || !lastName || !pin) {
    return { ok: false, error: "Podaj imię, nazwisko i PIN." };
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return { ok: false, error: "PIN musi mieć 4–6 cyfr." };
  }

  const { ok, status, json } = await fetchAwpJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      pin,
      remember_me: true,
      realm: "academy",
    }),
  });

  const body = (json ?? {}) as AwpLoginJson;
  if (!ok || !body.token) {
    const msg =
      typeof body.error === "string" && body.error.trim()
        ? body.error.trim()
        : status === 401
          ? "Nieprawidłowe dane logowania."
          : "Nie udało się połączyć z kontem Akademii.";
    return { ok: false, error: msg };
  }

  const profile = profileFromLogin(body);
  if (!profile) return { ok: false, error: "Nieprawidłowa odpowiedź Akademii." };

  // Uzupełnij e-mail z /me, jeśli konto ma go w AWP.
  const me = await fetchAwpProfileByToken(body.token);
  if (me.ok) {
    return {
      ok: true,
      token: body.token,
      profile: { ...profile, email: me.profile.email ?? profile.email },
    };
  }

  return { ok: true, token: body.token, profile };
}

/** Logowanie e-mail/hasło przez API Akademii (gdy włączone w AWP). */
export async function loginAwpWithEmail(
  input: AwpLoginEmailInput,
): Promise<
  | { ok: true; token: string; profile: AwpAccountProfile }
  | { ok: false; error: string }
> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !password) {
    return { ok: false, error: "Podaj e-mail i hasło." };
  }

  const { ok, status, json } = await fetchAwpJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      remember_me: true,
      realm: "academy",
    }),
  });

  const body = (json ?? {}) as AwpLoginJson;
  if (!ok || !body.token) {
    const msg =
      typeof body.error === "string" && body.error.trim()
        ? body.error.trim()
        : status === 401
          ? "Nieprawidłowe dane logowania."
          : "Nie udało się połączyć z kontem Akademii.";
    return { ok: false, error: msg };
  }

  const profile = profileFromLogin(body, email);
  if (!profile) return { ok: false, error: "Nieprawidłowa odpowiedź Akademii." };

  const me = await fetchAwpProfileByToken(body.token);
  if (me.ok) {
    return {
      ok: true,
      token: body.token,
      profile: {
        ...profile,
        email: me.profile.email ?? profile.email,
        firstName: me.profile.firstName || profile.firstName,
        lastName: me.profile.lastName || profile.lastName,
        zawodnik: me.profile.zawodnik || profile.zawodnik,
      },
    };
  }

  return { ok: true, token: body.token, profile };
}

/** Walidacja tokenu sesji AWP (Bearer) — używane przy SSO z iframe. */
export async function fetchAwpProfileByToken(
  token: string,
): Promise<{ ok: true; profile: AwpAccountProfile } | { ok: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Brak tokenu Akademii." };

  const { ok, json } = await fetchAwpJson("/api/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${trimmed}` },
  });

  if (!ok) {
    return { ok: false, error: "Sesja Akademii jest nieaktualna." };
  }

  const profile = profileFromMe((json ?? {}) as AwpMeJson);
  if (!profile) {
    return { ok: false, error: "Brak aktywnej sesji w Akademii." };
  }
  return { ok: true, profile };
}

/**
 * Upsert lokalnego użytkownika GymBrat powiązanego z kontem AWP.
 * Jedno konto = ten sam profil (imię, nazwisko) po obu stronach.
 */
export async function upsertGymBratUserFromAwp(profile: AwpAccountProfile): Promise<{
  id: string;
  email: string;
  name: string;
  role: "zawodnik" | "admin";
}> {
  const db = getDb();
  const name = displayName(profile.firstName, profile.lastName, profile.zawodnik);
  const preferredEmail =
    profile.email && profile.email.includes("@")
      ? profile.email
      : syntheticAwpEmail(profile.awpUserId);
  const role: "zawodnik" | "admin" = profile.isAdmin ? "admin" : "zawodnik";
  const awpKey = String(profile.awpUserId);

  const [byAwp] = await db
    .select()
    .from(users)
    .where(eq(users.awpUserId, awpKey))
    .limit(1);

  if (byAwp) {
    const nextEmail =
      byAwp.email.endsWith("@users.gymbrat.local") && profile.email
        ? preferredEmail
        : byAwp.email;
    await db
      .update(users)
      .set({
        firstName: profile.firstName || byAwp.firstName,
        lastName: profile.lastName || byAwp.lastName,
        name,
        email: nextEmail,
        ...(profile.isAdmin ? { appRole: "admin" as const } : {}),
      })
      .where(eq(users.id, byAwp.id));

    return {
      id: byAwp.id,
      email: nextEmail,
      name,
      role: byAwp.appRole === "admin" || profile.isAdmin ? "admin" : "zawodnik",
    };
  }

  // Powiąż istniejące konto e-mail (lokalna rejestracja GymBrat) z AWP.
  if (profile.email) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);
    if (byEmail) {
      await db
        .update(users)
        .set({
          awpUserId: awpKey,
          firstName: profile.firstName || byEmail.firstName,
          lastName: profile.lastName || byEmail.lastName,
          name,
          ...(profile.isAdmin ? { appRole: "admin" as const } : {}),
        })
        .where(eq(users.id, byEmail.id));

      return {
        id: byEmail.id,
        email: byEmail.email,
        name,
        role: byEmail.appRole === "admin" || profile.isAdmin ? "admin" : "zawodnik",
      };
    }
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hash(crypto.randomUUID() + crypto.randomUUID(), 10);

  await db.insert(users).values({
    id: userId,
    email: preferredEmail,
    passwordHash,
    name,
    firstName: profile.firstName || null,
    lastName: profile.lastName || null,
    appRole: role,
    awpUserId: awpKey,
  });

  await db.insert(userSettings).values({
    userId,
  });

  return { id: userId, email: preferredEmail, name, role };
}

export function isValidAwpPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}

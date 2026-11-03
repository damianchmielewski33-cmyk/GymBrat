/**
 * Konfiguracja wymagana do promote na produkcję (US14 / Z45).
 * Źródło prawdy dla opisów i grup: `lib/admin-config-status.ts` — test
 * `lib/deploy-required-env.test.ts` pilnuje, że nazwy tu = nazwy tam.
 */
export const REQUIRED_PRODUCTION_ENV = [
  {
    id: "payments",
    label: "Płatności (HotPay)",
    names: ["HOTPAY_SEKRET", "HOTPAY_NOTIFICATION_PASSWORD"],
  },
  {
    id: "email",
    label: "Wysyłka e-mail (SMTP)",
    names: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
  },
  {
    id: "rate-limit",
    label: "Limity żądań (Upstash)",
    names: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  },
  {
    id: "cron",
    label: "Zadania cykliczne (cron)",
    names: ["CRON_SECRET"],
  },
  {
    id: "admin-access",
    label: "Dostęp do panelu admina",
    names: ["ADMIN_EMAILS"],
    /** ADMIN_EMAILS musi zawierać choć jeden adres e-mail. */
    validate: (value) => /\S+@\S+/.test(value),
  },
];

/** Zwraca listę brakujących/niepoprawnych pozycji: `{ id, label, missing: string[] }`. */
export function missingProductionEnv(env) {
  const problems = [];
  for (const group of REQUIRED_PRODUCTION_ENV) {
    const missing = group.names.filter((name) => {
      const value = String(env[name] ?? "").trim();
      if (!value) return true;
      return group.validate ? !group.validate(value) : false;
    });
    if (missing.length > 0) {
      problems.push({ id: group.id, label: group.label, missing });
    }
  }
  return problems;
}

/** Prosty parser pliku `.env` (KEY=VALUE, komentarze `#`, cudzysłowy). */
export function parseEnvFile(text) {
  const env = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

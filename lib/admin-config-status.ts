/**
 * Diagnostyka konfiguracji aplikacji (zmienne środowiskowe) dla panelu admina.
 * Nigdy nie zwracamy WARTOŚCI zmiennych — tylko informację, czy są ustawione.
 */

export type ConfigLevel = "required" | "recommended" | "optional";
export type ConfigStatus = "ok" | "partial" | "missing";

export type ConfigGroupId =
  | "core"
  | "users"
  | "content"
  | "monitoring"
  | "mobile";

type VarSpec = {
  /** Pierwsza nazwa jest główna, pozostałe to aliasy akceptowane przez kod. */
  names: string[];
  /** Zmienna dodatkowa — jej brak nie obniża statusu integracji. */
  optional?: boolean;
  hint?: string;
};

type IntegrationDef = {
  id: string;
  group: ConfigGroupId;
  label: string;
  description: string;
  level: ConfigLevel;
  /** Co się dzieje, gdy integracja nie jest skonfigurowana. */
  effectWhenMissing: string;
  /** Gdzie i jak ustawić to na hostingu (Vercel / Render / GitHub). */
  hostingHint?: string;
  vars: VarSpec[];
  link?: { href: string; label: string };
};

export type ConfigVarState = {
  name: string;
  aliases: string[];
  present: boolean;
  optional: boolean;
  hint?: string;
};

export type ConfigIntegration = {
  id: string;
  group: ConfigGroupId;
  label: string;
  description: string;
  level: ConfigLevel;
  status: ConfigStatus;
  effectWhenMissing: string;
  hostingHint: string;
  vars: ConfigVarState[];
  /** Główne nazwy brakujących zmiennych wymaganych przez integrację. */
  missing: string[];
  link?: { href: string; label: string };
};

export type ConfigSummary = {
  total: number;
  ok: number;
  /** Wymagane integracje, które nie działają w pełni. */
  requiredIssues: number;
  /** Zalecane integracje, które nie działają w pełni. */
  recommendedIssues: number;
  /**
   * Wymagane + zalecane, które nie działają — to widać w panelu jako
   * „trzeba skonfigurować na hostingu”. Opcjonalne (Google, Sentry…) nie wchodzą.
   */
  hostingIssues: number;
  /** 0–100: odsetek wymaganych + zalecanych integracji, które działają. */
  readiness: number;
};

/** Domyślna instrukcja, gdy integracja nie ma własnego opisu hostingu. */
export const DEFAULT_HOSTING_HINT =
  "Ustaw zmienne w środowisku hostingu (Vercel → Settings → Environment Variables albo Render → Environment) i zrób redeploy. Wartości nie są tu pokazywane.";

export const CONFIG_GROUP_LABELS: Record<ConfigGroupId, { label: string; description: string }> = {
  core: {
    label: "Rdzeń aplikacji",
    description: "Baza, logowanie, bezpieczeństwo i dostęp do panelu.",
  },
  users: {
    label: "Użytkownicy i płatności",
    description: "Rejestracja, logowanie społecznościowe, pakiety i dane sprzedawcy.",
  },
  content: {
    label: "Treści",
    description: "Grafiki przepisów i baza produktów.",
  },
  monitoring: {
    label: "Monitoring i analityka",
    description: "Limity hostingu, błędy i analityka ruchu.",
  },
  mobile: {
    label: "Aplikacja mobilna",
    description: "Budowanie APK i reklamy.",
  },
};

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "database",
    group: "core",
    label: "Baza danych (Turso)",
    description: "Główna baza aplikacji.",
    level: "required",
    effectWhenMissing: "Aplikacja nie uruchomi się — brak połączenia z bazą.",
    vars: [
      { names: ["TURSO_DATABASE_URL"], hint: "Lokalnie: file:./local.db" },
      { names: ["TURSO_AUTH_TOKEN"], optional: true, hint: "Wymagany dla Turso w chmurze." },
    ],
  },
  {
    id: "auth",
    group: "core",
    label: "Sesje i logowanie",
    description: "Sekret podpisujący sesje i token odblokowania panelu.",
    level: "required",
    effectWhenMissing: "Nie da się bezpiecznie logować ani odblokować panelu admina.",
    vars: [{ names: ["AUTH_SECRET", "NEXTAUTH_SECRET"] }],
  },
  {
    id: "app-url",
    group: "core",
    label: "Adres publiczny aplikacji",
    description: "Używany w mailach, sitemap, robots oraz do weryfikacji CSRF.",
    level: "recommended",
    effectWhenMissing:
      "Linki w mailach i sitemap mogą wskazywać na adres domyślny; CSRF opiera się wtedy tylko na adresie hostingu.",
    vars: [
      { names: ["NEXT_PUBLIC_APP_URL", "AUTH_URL", "NEXTAUTH_URL"] },
      { names: ["CSRF_ALLOWED_ORIGINS"], optional: true, hint: "Dodatkowe originy po przecinku." },
    ],
  },
  {
    id: "admin-access",
    group: "core",
    label: "Dostęp do panelu admina",
    description: "PIN odblokowania i dodatkowe konta z rolą administratora.",
    level: "required",
    effectWhenMissing: "W produkcji brak PIN-u blokuje odblokowanie panelu.",
    vars: [
      { names: ["ADMIN_PIN"] },
      { names: ["ADMIN_EMAILS"], optional: true, hint: "Adresy e-mail adminów po przecinku." },
    ],
  },
  {
    id: "encryption",
    group: "core",
    label: "Szyfrowanie danych",
    description: "Klucz do szyfrowania wrażliwych pól (np. tokenów).",
    level: "recommended",
    effectWhenMissing: "Wrażliwe pola nie będą szyfrowane.",
    vars: [{ names: ["APP_ENCRYPTION_KEY"], hint: "32 bajty w base64." }],
  },
  {
    id: "cron",
    group: "core",
    label: "Zadania cykliczne (cron)",
    description: "Autoryzacja endpointów sprzątania danych i przypomnień.",
    level: "recommended",
    effectWhenMissing:
      "Endpointy /api/cron/cleanup i /api/cron/reminders odrzucają żądania — baza nie jest sprzątana, a przypomnienia push i skrót e-mail nie wychodzą.",
    hostingHint:
      "Ustaw CRON_SECRET w zmiennych środowiska aplikacji. Przypomnienia przy zamkniętej karcie wymagają też wywołania POST /api/cron/reminders co 5 min: sekrety GitHub REMINDERS_APP_URL + CRON_SECRET (workflow Reminders cron) albo cron na VPS.",
    vars: [{ names: ["CRON_SECRET"] }],
  },
  {
    id: "rate-limit",
    group: "core",
    label: "Limity żądań (Upstash)",
    description: "Współdzielone limity prób logowania i akcji serwerowych.",
    level: "recommended",
    effectWhenMissing:
      "Limity działają tylko w pamięci jednej instancji — na wielu instancjach są łatwiejsze do obejścia.",
    vars: [{ names: ["UPSTASH_REDIS_REST_URL"] }, { names: ["UPSTASH_REDIS_REST_TOKEN"] }],
  },
  {
    id: "email",
    group: "users",
    label: "Wysyłka e-mail (SMTP)",
    description: "Kody weryfikacyjne przy rejestracji i powiadomienia.",
    level: "recommended",
    effectWhenMissing:
      "Kody rejestracyjne i dzienny skrót e-mail z przypomnień nie są wysyłane.",
    vars: [
      { names: ["SMTP_HOST"] },
      { names: ["SMTP_USER"] },
      { names: ["SMTP_PASS"] },
      { names: ["SMTP_PORT"], optional: true, hint: "Domyślnie 587." },
      { names: ["EMAIL_FROM"], optional: true, hint: "Domyślnie SMTP_USER." },
      { names: ["EMAIL_CODE_SECRET"], optional: true, hint: "Bez tego używany jest AUTH_SECRET." },
    ],
  },
  {
    id: "web-push",
    group: "users",
    label: "Powiadomienia push (Web Push)",
    description: "Przypomnienia o treningu, posiłku i check-inie przy zamkniętej karcie lub aplikacji w przeglądarce.",
    level: "recommended",
    effectWhenMissing:
      "Przypomnienia w przeglądarce nie przychodzą przy zamkniętej karcie. Aplikacja Android ustawia własne alarmy niezależnie od tego.",
    hostingHint:
      "Wygeneruj klucze (`npx web-push generate-vapid-keys`) i ustaw VAPID_PUBLIC_KEY oraz VAPID_PRIVATE_KEY w zmiennych środowiska hostingu. Cron przypomnień (CRON_SECRET + wywołanie co 5 min) też musi działać.",
    vars: [
      {
        names: ["VAPID_PUBLIC_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"],
        hint: "Wygeneruj parę kluczy: npx web-push generate-vapid-keys.",
      },
      { names: ["VAPID_PRIVATE_KEY"] },
      { names: ["VAPID_SUBJECT"], optional: true, hint: "mailto: lub https:// właściciela serwisu." },
    ],
  },
  {
    id: "google",
    group: "users",
    label: "Logowanie przez Google",
    description: "Przycisk „Zaloguj przez Google”.",
    level: "optional",
    effectWhenMissing: "Użytkownicy logują się tylko e-mailem i hasłem.",
    vars: [{ names: ["AUTH_GOOGLE_ID"] }, { names: ["AUTH_GOOGLE_SECRET"] }],
  },
  {
    id: "facebook",
    group: "users",
    label: "Logowanie przez Facebooka",
    description: "Przycisk „Zaloguj przez Facebooka”.",
    level: "optional",
    effectWhenMissing: "Użytkownicy logują się tylko e-mailem i hasłem.",
    vars: [{ names: ["AUTH_FACEBOOK_ID"] }, { names: ["AUTH_FACEBOOK_SECRET"] }],
  },
  {
    id: "payments",
    group: "users",
    label: "Płatności (HotPay)",
    description: "Zakup pakietów premium.",
    level: "recommended",
    effectWhenMissing: "Użytkownicy nie kupią pakietu — przycisk płatności jest nieaktywny.",
    vars: [
      { names: ["HOTPAY_SEKRET"] },
      { names: ["HOTPAY_NOTIFICATION_PASSWORD"] },
      { names: ["HOTPAY_PAYMENT_URL"], optional: true },
    ],
    link: { href: "/admin/packages", label: "Pakiety i ceny" },
  },
  {
    id: "legal",
    group: "users",
    label: "Dane sprzedawcy (regulamin)",
    description: "Dane firmy wyświetlane w regulaminie i polityce prywatności.",
    level: "recommended",
    effectWhenMissing: "Strony prawne nie pokażą kompletnych danych sprzedawcy.",
    vars: [
      { names: ["LEGAL_SELLER_NAME"] },
      { names: ["LEGAL_SELLER_ADDRESS"] },
      { names: ["LEGAL_SELLER_NIP"] },
      { names: ["LEGAL_CONTACT_EMAIL"] },
      { names: ["LEGAL_SELLER_REGON", "LEGAL_SELLER_KRS", "LEGAL_CONTACT_PHONE"], optional: true },
    ],
  },
  {
    id: "recipe-images",
    group: "content",
    label: "Grafiki przepisów (AI)",
    description: "Generowanie zdjęć przepisów przy imporcie katalogu.",
    level: "recommended",
    effectWhenMissing: "Import przepisów zapisze dane, ale bez grafik.",
    vars: [
      { names: ["POLLINATIONS_API_KEY", "POLLINATIONS_KEY"] },
      { names: ["POLLINATIONS_DAILY_LIMIT"], optional: true },
    ],
    link: { href: "/admin/catalog", label: "Katalog przepisów" },
  },
  {
    id: "nutrition",
    group: "content",
    label: "Baza produktów (USDA FDC)",
    description: "Wyszukiwanie wartości odżywczych produktów.",
    level: "optional",
    effectWhenMissing: "Wyszukiwanie korzysta wyłącznie z innych źródeł produktów.",
    vars: [{ names: ["FDC_API_KEY", "USDA_FDC_API_KEY"] }],
  },
  {
    id: "errors",
    group: "monitoring",
    label: "Raportowanie błędów (Sentry)",
    description: "Automatyczne zgłaszanie błędów aplikacji.",
    level: "optional",
    effectWhenMissing: "Błędy runtime widzisz tylko w logach hostingu.",
    vars: [{ names: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] }],
  },
  {
    id: "analytics",
    group: "monitoring",
    label: "Analityka produktowa (PostHog)",
    description: "Zdarzenia użytkowników po stronie klienta i serwera.",
    level: "optional",
    effectWhenMissing: "Działa wyłącznie wbudowana analityka odsłon w panelu.",
    vars: [
      { names: ["NEXT_PUBLIC_POSTHOG_KEY"] },
      { names: ["POSTHOG_API_KEY"], optional: true },
      { names: ["POSTHOG_HOST", "NEXT_PUBLIC_POSTHOG_HOST"], optional: true },
    ],
  },
  {
    id: "hosting-monitor",
    group: "monitoring",
    label: "Limity hostingu (Render + Turso)",
    description: "Dane do kafelków „Limity hostingu i bazy” w Analityce.",
    level: "optional",
    effectWhenMissing: "Kafelki limitów Render/Turso pokazują „brak konfiguracji”.",
    vars: [
      { names: ["RENDER_API_KEY"] },
      { names: ["RENDER_SERVICE_ID"] },
      { names: ["TURSO_API_TOKEN"] },
      { names: ["TURSO_ORG_SLUG"] },
      { names: ["RENDER_BANDWIDTH_LIMIT_GB"], optional: true },
    ],
    link: { href: "/admin/overview", label: "Analityka" },
  },
  {
    id: "android",
    group: "mobile",
    label: "Budowanie aplikacji Android",
    description: "Automatyczna przebudowa APK po zmianie ikony oraz pobieranie APK.",
    level: "optional",
    effectWhenMissing: "Zmiana ikony Androida nie uruchomi przebudowy APK.",
    vars: [
      { names: ["GITHUB_APK_DISPATCH_TOKEN"] },
      { names: ["ANDROID_APK_URL", "NEXT_PUBLIC_ANDROID_APK_URL"], optional: true },
      {
        names: ["ANDROID_VERSION_JSON_URL"],
        optional: true,
        hint: "JSON z versionCode / versionName najnowszego APK.",
      },
    ],
    link: { href: "/admin/branding", label: "Branding" },
  },
  {
    id: "java-api",
    group: "core",
    label: "Backend Java (BFF)",
    description: "Proxy wybranych /api/* do Spring Boot (java-backend).",
    level: "optional",
    effectWhenMissing: "Next obsługuje API samodzielnie — bez osobnego serwera Java.",
    vars: [
      { names: ["JAVA_API_BASE_URL"], hint: "np. http://localhost:8080" },
      { names: ["GYMBRAT_PROXY_TOKEN"], optional: true, hint: "Wymagany, gdy Java API jest włączone." },
    ],
  },
  {
    id: "ads",
    group: "mobile",
    label: "Reklamy (AdMob)",
    description: "Reklama pełnoekranowa dla kont bez pakietu.",
    level: "optional",
    effectWhenMissing: "Konta bez pakietu nie widzą reklam.",
    vars: [{ names: ["NEXT_PUBLIC_ADMOB_INTERSTITIAL_ID"] }],
  },
];

type Env = Record<string, string | undefined>;

function isSet(env: Env, names: string[]): boolean {
  return names.some((n) => Boolean(env[n]?.trim()));
}

function evaluate(def: IntegrationDef, env: Env): ConfigIntegration {
  const vars: ConfigVarState[] = def.vars.map((v) => ({
    name: v.names[0],
    aliases: v.names.slice(1),
    present: isSet(env, v.names),
    optional: Boolean(v.optional),
    hint: v.hint,
  }));

  const needed = vars.filter((v) => !v.optional);
  const presentNeeded = needed.filter((v) => v.present).length;
  const status: ConfigStatus =
    presentNeeded === needed.length
      ? "ok"
      : presentNeeded === 0
        ? "missing"
        : "partial";

  return {
    id: def.id,
    group: def.group,
    label: def.label,
    description: def.description,
    level: def.level,
    status,
    effectWhenMissing: def.effectWhenMissing,
    hostingHint: def.hostingHint ?? DEFAULT_HOSTING_HINT,
    vars,
    missing: needed.filter((v) => !v.present).map((v) => v.name),
    link: def.link,
  };
}

/** Wszystkie nazwy (i aliasy) śledzone w panelu Konfiguracja. */
export function listTrackedEnvNames(): string[] {
  const names = new Set<string>();
  for (const def of INTEGRATIONS) {
    for (const v of def.vars) for (const n of v.names) names.add(n);
  }
  return [...names].sort();
}

/** Odmiana: 1 funkcję / 2 funkcje / 5 funkcji. */
export function formatHostingFunctionCount(count: number): string {
  if (count === 1) return "1 funkcję";
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "funkcje" : "funkcji";
  return `${count} ${noun}`;
}

export function getConfigStatus(env: Env = process.env): ConfigIntegration[] {
  return INTEGRATIONS.map((def) => evaluate(def, env));
}

export function summarizeConfig(items: ConfigIntegration[]): ConfigSummary {
  const ok = items.filter((i) => i.status === "ok").length;
  const requiredIssues = items.filter(
    (i) => i.level === "required" && i.status !== "ok",
  ).length;
  const recommendedIssues = items.filter(
    (i) => i.level === "recommended" && i.status !== "ok",
  ).length;
  const scored = items.filter((i) => i.level !== "optional");
  const scoredOk = scored.filter((i) => i.status === "ok").length;
  return {
    total: items.length,
    ok,
    requiredIssues,
    recommendedIssues,
    hostingIssues: requiredIssues + recommendedIssues,
    readiness: scored.length ? Math.round((scoredOk / scored.length) * 100) : 100,
  };
}

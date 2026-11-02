import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing ${name}. Set SMTP variables for outbound mail (see env.example).`,
    );
  }
  return v.trim();
}

/** Jedno miejsce sprawdzania, czy wysyłka SMTP jest skonfigurowana (bez wartości zmiennych). */
export function isSmtpConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());
}

/** Tworzy transporter SMTP (Gmail / Outlook / dowolny host — patrz env.example). */
function createSmtpTransport() {
  const host = requireEnv("SMTP_HOST");
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  const portRaw = process.env.SMTP_PORT ?? "587";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid SMTP_PORT: ${portRaw}`);
  }

  const secureExplicit = process.env.SMTP_SECURE;
  const secure =
    secureExplicit === "true" ||
    secureExplicit === "1" ||
    port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Nadawca w nagłówku From — musi być adres skrzynki lub alias dozwolony przez providera.
 * Jeśli nie ustawisz EMAIL_FROM, używamy SMTP_USER (działa typowo dla Gmail / Outlook).
 */
export function getEmailFrom(): string {
  const explicit = process.env.EMAIL_FROM?.trim();
  if (explicit) return explicit;
  return requireEnv("SMTP_USER");
}

/** Cron / przypomnienia — nie rzuca, jeśli SMTP nie jest skonfigurowane. */
export async function sendOptionalDailyBriefEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  try {
    const transport = createSmtpTransport();
    const from = getEmailFrom();
    const replyTo = process.env.EMAIL_REPLY_TO?.trim();
    await transport.sendMail({
      from,
      to: params.to,
      ...(replyTo ? { replyTo } : {}),
      subject: params.subject,
      text: params.text,
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendPasswordResetCodeEmail(params: {
  to: string;
  code: string;
  minutesValid: number;
}): Promise<void> {
  const transport = createSmtpTransport();
  const from = getEmailFrom();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  await transport.sendMail({
    from,
    to: params.to,
    ...(replyTo ? { replyTo } : {}),
    subject: "GymBrat — kod do zmiany hasła",
    text: `Twój kod do zmiany hasła w GymBrat: ${params.code}\n\nKod jest ważny przez ${params.minutesValid} min.\n\nJeśli to nie Ty prosiłeś o zmianę hasła, zignoruj tę wiadomość — Twoje hasło pozostaje bez zmian.`,
  });
}

export async function sendRegisterVerificationCodeEmail(params: {
  to: string;
  code: string;
  minutesValid: number;
}): Promise<void> {
  const transport = createSmtpTransport();
  const from = getEmailFrom();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  await transport.sendMail({
    from,
    to: params.to,
    ...(replyTo ? { replyTo } : {}),
    subject: "GymBrat — kod weryfikacyjny rejestracji",
    text: `Twój kod weryfikacyjny do rejestracji w GymBrat: ${params.code}\n\nKod jest ważny przez ${params.minutesValid} min.\n\nJeśli to nie Ty, zignoruj tę wiadomość.`,
  });
}

/**
 * Potwierdzenie zakupu pakietu (Z20). Wysyłane po opłaceniu zamówienia; wywołujący łapie błąd,
 * żeby brak SMTP nie psuł księgowania płatności. Bez danych wrażliwych — tylko plan, okres i kwota.
 */
export async function sendOrderConfirmationEmail(params: {
  to: string;
  planSku: string;
  days: number;
  amountGrosze: number;
}): Promise<void> {
  if (!isSmtpConfigured()) return;
  const transport = createSmtpTransport();
  const from = getEmailFrom();
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const price = `${(Math.max(0, Math.round(params.amountGrosze)) / 100).toFixed(2).replace(".", ",")} zł`;

  await transport.sendMail({
    from,
    to: params.to,
    ...(replyTo ? { replyTo } : {}),
    subject: "GymBrat — potwierdzenie zakupu pakietu",
    text: `Dziękujemy za zakup pakietu GymBrat.\n\nPakiet: ${params.planSku} (${params.days} dni)\nKwota: ${price}\n\nPakiet został aktywowany. Historię zamówień i potwierdzenie zakupu znajdziesz w aplikacji: Pakiet → Moje zamówienia.\n\n— GymBrat`,
  });
}

/** Z24: przypomnienie o końcu pakietu (wysyłane tylko za zgodą `push`). */
export async function sendPackageExpiryEmail(params: { to: string; daysLeft: number }): Promise<boolean> {
  return sendOptionalDailyBriefEmail({
    to: params.to,
    subject: "GymBrat — Twój pakiet wkrótce się kończy",
    text: `Twój pakiet GymBrat kończy się za ${params.daysLeft} ${params.daysLeft === 1 ? "dzień" : "dni"}.\n\nPrzedłużenie liczymy od końca bieżącego pakietu, więc nic nie tracisz: Pakiet → Przedłuż.\n\nNie chcesz takich wiadomości? Wyłącz zgodę na przypomnienia w Profilu → Konto.\n\n— GymBrat`,
  });
}

/** Z14: potwierdzenie usunięcia konta. Best-effort — adres nie jest nigdzie zapisywany po wysyłce. */
export async function sendAccountDeletedEmail(params: { to: string }): Promise<boolean> {
  return sendOptionalDailyBriefEmail({
    to: params.to,
    subject: "GymBrat — konto zostało usunięte",
    text: "Potwierdzamy usunięcie Twojego konta GymBrat wraz z danymi o treningach, ciele, posiłkach, zdjęciami i powiązaniami logowania.\n\nDokumentacja sprzedaży (zamówienia pakietów) jest przechowywana w formie niepowiązanej z kontem przez okres wymagany prawem.\n\nJeśli to nie Ty usunąłeś konto, skontaktuj się z nami odpowiadając na tę wiadomość.\n\n— GymBrat",
  });
}

/** Z28: ostrzeżenie przed usunięciem zdjęć / konta z powodu nieaktywności. */
export async function sendInactivityWarningEmail(params: {
  to: string;
  kind: "photos" | "account";
  daysToDelete: number;
}): Promise<boolean> {
  const what =
    params.kind === "account"
      ? "Twoje konto GymBrat wraz ze wszystkimi danymi zostanie usunięte"
      : "Twoje zdjęcia sylwetki w GymBrat zostaną usunięte (konto i pozostałe dane zostają)";
  return sendOptionalDailyBriefEmail({
    to: params.to,
    subject:
      params.kind === "account"
        ? "GymBrat — Twoje konto zostanie usunięte z powodu nieaktywności"
        : "GymBrat — Twoje zdjęcia zostaną usunięte z powodu nieaktywności",
    text: `Od dłuższego czasu nie korzystasz z GymBrat. ${what} za ${params.daysToDelete} dni.\n\nAby tego uniknąć, wystarczy się zalogować. Przed usunięciem możesz też pobrać swoje dane w Profilu → Konto.\n\n— GymBrat`,
  });
}

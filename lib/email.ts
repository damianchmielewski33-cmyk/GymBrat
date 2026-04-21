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

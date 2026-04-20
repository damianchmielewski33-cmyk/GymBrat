import { Resend } from "resend";

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY. Configure an email provider on production (Vercel env vars).",
    );
  }
  return new Resend(apiKey);
}

export function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error(
      'Missing EMAIL_FROM (e.g. "GymBrat <no-reply@yourdomain.com>").',
    );
  }
  return from;
}

export async function sendRegisterVerificationCodeEmail(params: {
  to: string;
  code: string;
  minutesValid: number;
}): Promise<void> {
  const resend = getResend();
  const from = getEmailFrom();
  const replyTo = process.env.EMAIL_REPLY_TO;

  await resend.emails.send({
    from,
    to: params.to,
    ...(replyTo ? { replyTo } : {}),
    subject: "GymBrat — kod weryfikacyjny rejestracji",
    text: `Twój kod weryfikacyjny do rejestracji w GymBrat: ${params.code}\n\nKod jest ważny przez ${params.minutesValid} min.\n\nJeśli to nie Ty, zignoruj tę wiadomość.`,
  });
}


import "server-only";

import { createHash } from "node:crypto";

export function hotpayConfigured(): boolean {
  return Boolean(
    process.env.HOTPAY_SEKRET?.trim() &&
      process.env.HOTPAY_NOTIFICATION_PASSWORD?.trim(),
  );
}

export function hotpayPaymentUrl(): string {
  return (
    process.env.HOTPAY_PAYMENT_URL?.trim() || "https://platnosc.hotpay.pl/"
  );
}

export function hotpaySekret(): string {
  return process.env.HOTPAY_SEKRET?.trim() ?? "";
}

function notificationPassword(): string {
  return process.env.HOTPAY_NOTIFICATION_PASSWORD?.trim() ?? "";
}

/** HASH przy starcie płatności (formularz POST). */
export function buildHotpayPaymentHash(args: {
  kwota: string;
  nazwaUslugi: string;
  adresWww: string;
  idZamowienia: string;
}): string {
  const raw = [
    notificationPassword(),
    args.kwota,
    args.nazwaUslugi,
    args.adresWww,
    args.idZamowienia,
    hotpaySekret(),
  ].join(";");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * HASH notyfikacji — wg dokumentacja.hotpay.pl:
 * HASLO;KWOTA;ID_PLATNOSCI;ID_ZAMOWIENIA;STATUS;SECURE;SEKRET
 * (starsze PDF bez SECURE też obsługujemy jako fallback).
 */
export function verifyHotpayNotificationHash(fields: {
  kwota: string;
  idPlatnosci: string;
  idZamowienia: string;
  status: string;
  secure?: string;
  sekret: string;
  hash: string;
}): boolean {
  const pwd = notificationPassword();
  if (!pwd) return false;
  const withSecure = createHash("sha256")
    .update(
      [
        pwd,
        fields.kwota,
        fields.idPlatnosci,
        fields.idZamowienia,
        fields.status,
        fields.secure ?? "",
        fields.sekret,
      ].join(";"),
      "utf8",
    )
    .digest("hex");
  if (timingSafeEqualHex(withSecure, fields.hash)) return true;

  const withoutSecure = createHash("sha256")
    .update(
      [
        pwd,
        fields.kwota,
        fields.idPlatnosci,
        fields.idZamowienia,
        fields.status,
        fields.sekret,
      ].join(";"),
      "utf8",
    )
    .digest("hex");
  return timingSafeEqualHex(withoutSecure, fields.hash);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) {
    out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return out === 0;
}

/** Kwota w formacie HotPay: "3.99" */
export function formatHotpayKwota(grosze: number): string {
  return (Math.max(0, Math.round(grosze)) / 100).toFixed(2);
}

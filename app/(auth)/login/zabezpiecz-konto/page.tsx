import type { Metadata } from "next";
import { readTakeoverToken } from "@/actions/account-takeover";
import { AccountTakeoverScreen } from "@/components/auth/account-takeover-screen";

export const metadata: Metadata = {
  title: "Zabezpiecz adres e-mail",
  robots: { index: false, follow: false },
  // Token jest w adresie — nie przekazujemy go dalej w nagłówku Referer.
  referrer: "no-referrer",
};

type Search = Promise<{ t?: string | string[] }>;

/** UX 001, 4A — potwierdzenie przejęcia konta niezweryfikowanego (ADR 0001 D4). */
export default async function SecureAccountPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const raw = (await searchParams).t;
  const token = Array.isArray(raw) ? raw[0] : raw;
  const valid = token ? (await readTakeoverToken(token)).valid : false;

  return <AccountTakeoverScreen token={valid && token ? token : null} />;
}

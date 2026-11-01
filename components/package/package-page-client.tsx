"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { PRIVACY_PATH, REGULAMIN_PATH } from "@/lib/legal-seller";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";
import { cn } from "@/lib/utils";

export type PackagePlanCard = {
  sku: string;
  title: string;
  description: string;
  days: number;
  priceGrosze: number;
};

const FEATURED_SKU = "d30";

const BENEFITS = [
  "Bez reklam przed treningiem",
  "Bez reklam przy dodawaniu produktu",
] as const;

/** Pakiet roczny (i dłuższe) dostaje szeroki blok; krótsze idą w jednym rzędzie. */
function isLongPlan(p: PackagePlanCard): boolean {
  return p.days >= 365;
}

function PlanBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-[var(--gym-gold)] px-2.5 text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-black">
      {children}
    </span>
  );
}

function BuyButton({
  solid,
  busy,
  disabled,
  onClick,
  className,
}: {
  solid: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={solid ? "default" : "outline"}
      className={cn("w-full rounded-full px-3 text-[13px]", className)}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? "Przekierowanie…" : "Kup pakiet"}
    </Button>
  );
}

export function PackagePageClient({
  plans,
  packageActive,
  daysLeft,
  endsLabel,
  planSku,
  paidHint,
}: {
  plans: PackagePlanCard[];
  packageActive: boolean;
  daysLeft: number | null;
  endsLabel: string | null;
  planSku: string | null;
  paidHint?: boolean;
}) {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [busySku, setBusySku] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const shortPlans = plans.filter((p) => !isLongPlan(p));
  const longPlans = plans.filter(isLongPlan);

  async function checkout(sku: string) {
    if (!termsAccepted) {
      notifyError(
        "Aby kupić pakiet, zaakceptuj Regulamin i zgodę na rozpoczęcie świadczenia.",
      );
      return;
    }
    setBusySku(sku);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/package/checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ sku }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        paymentUrl?: string;
        fields?: Record<string, string>;
      } | null;
      if (!res.ok || !data?.ok || !data.paymentUrl || !data.fields) {
        notifyError(data?.error ?? "Nie udało się rozpocząć płatności.");
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.paymentUrl;
      form.acceptCharset = "UTF-8";
      for (const [name, value] of Object.entries(data.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      notifyError("Nie udało się rozpocząć płatności.");
    } finally {
      setBusySku(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 pb-28 pt-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
          Twój pakiet
        </p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold leading-tight text-white">
          {packageActive ? "Pakiet aktywny" : "Bez reklam — wybierz pakiet"}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60">
          {packageActive
            ? `Zostało ${daysLeft ?? "—"} dni${endsLabel ? ` (do ${endsLabel})` : ""}${
                planSku ? ` · ${planSku}` : ""
              }.`
            : "Bez aktywnego pakietu w aplikacji pojawiają się pełnoekranowe reklamy (AdMob) przed treningiem i dodaniem produktu."}
        </p>
        {paidHint ? (
          <p className="mt-3 rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 px-3 py-2 text-sm text-[var(--gym-gold)]">
            Dziękujemy — po potwierdzeniu płatności pakiet aktywuje się
            automatycznie (zwykle w ciągu kilku sekund).
          </p>
        ) : null}
      </header>

      {!packageActive ? (
        <ul className="flex flex-wrap gap-2" aria-label="Co zyskujesz z pakietem">
          {BENEFITS.map((text) => (
            <li
              key={text}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[12px] text-white/85"
            >
              <Check
                className="h-3.5 w-3.5 shrink-0 text-[var(--gym-gold)]"
                strokeWidth={2.5}
                aria-hidden
              />
              {text}
            </li>
          ))}
        </ul>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gym-gold)]"
        />
        <span className="text-[13px] leading-relaxed text-white/70">
          Akceptuję{" "}
          <Link
            href={REGULAMIN_PATH}
            className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Regulamin
          </Link>{" "}
          oraz{" "}
          <Link
            href={PRIVACY_PATH}
            className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Politykę prywatności
          </Link>
          . Żądam rozpoczęcia świadczenia Pakietu przed upływem 14-dniowego
          terminu odstąpienia i przyjmuję do wiadomości, że po aktywacji
          tracę prawo odstąpienia od umowy o treść cyfrową.
        </span>
      </label>

      {shortPlans.length > 0 ? (
        <div
          className="grid gap-2.5"
          style={{
            gridTemplateColumns: `repeat(${Math.min(shortPlans.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {shortPlans.map((p) => {
            const featured = p.sku === FEATURED_SKU;
            return (
              <article
                key={p.sku}
                className={cn(
                  "flex min-w-0 flex-col rounded-2xl border p-3.5",
                  featured
                    ? "border-[var(--gym-gold)]/70 bg-gradient-to-b from-[var(--gym-gold)]/[0.12] to-[var(--gym-gold)]/[0.03]"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                {/* Stała wysokość na odznakę — liczby dni stoją na jednej linii. */}
                <div className="mb-3 h-5">
                  {featured ? (
                    <PlanBadge>Polecany</PlanBadge>
                  ) : null}
                </div>
                <h2 className="flex items-baseline gap-1.5 text-white">
                  <span className="font-display text-[44px] leading-none">
                    {p.days}
                  </span>
                  <span className="font-heading text-[14px] text-white/55">
                    dni
                  </span>
                </h2>
                <p className="mt-3 flex-1 text-[12px] leading-snug text-white/55">
                  {p.description}
                </p>
                <p className="mt-4 whitespace-nowrap font-display text-[22px] leading-none text-[var(--gym-gold)]">
                  {formatPlnFromGrosze(p.priceGrosze)}
                </p>
                <BuyButton
                  solid={featured}
                  busy={busySku === p.sku}
                  disabled={busySku != null || !termsAccepted}
                  onClick={() => void checkout(p.sku)}
                  className="mt-3"
                />
              </article>
            );
          })}
        </div>
      ) : null}

      {longPlans.map((p) => (
        <article
          key={p.sku}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-[var(--gym-gold)]/60 bg-gradient-to-br from-[var(--gym-gold)]/[0.16] via-[var(--gym-gold)]/[0.05] to-transparent p-4"
        >
          <div className="min-w-0">
            <PlanBadge>Najlepsza cena</PlanBadge>
            <h2 className="mt-3 font-display text-[48px] leading-none text-white">
              {p.title}
            </h2>
            <p className="mt-2 text-[13px] leading-snug text-white/65">
              {p.description}
            </p>
          </div>
          <div className="flex w-[8.5rem] flex-col items-stretch gap-3 text-right">
            <p className="whitespace-nowrap font-display text-[26px] leading-none text-[var(--gym-gold)]">
              {formatPlnFromGrosze(p.priceGrosze)}
            </p>
            <BuyButton
              solid
              busy={busySku === p.sku}
              disabled={busySku != null || !termsAccepted}
              onClick={() => void checkout(p.sku)}
            />
          </div>
        </article>
      ))}

      {plans.length === 0 ? (
        <p className="text-sm text-white/45">Brak aktywnych pakietów w ofercie.</p>
      ) : null}

      <p className="text-[12px] leading-relaxed text-white/50">
        Płatność przez zewnętrzną bramkę płatniczą. Dokumenty:{" "}
        <Link
          href={REGULAMIN_PATH}
          className="text-[var(--gym-gold)] underline underline-offset-2"
        >
          Regulamin
        </Link>
        {" · "}
        <Link
          href={PRIVACY_PATH}
          className="text-[var(--gym-gold)] underline underline-offset-2"
        >
          Polityka prywatności
        </Link>
      </p>

      <button
        type="button"
        className="block text-left text-[12px] text-white/50 underline-offset-2 hover:text-white/70 hover:underline"
        onClick={() => notifySaved("Status pakietu odświeżany przy każdym wejściu.")}
      >
        Problemy z płatnością? Sprawdź e-mail / wróć tu po chwili.
      </button>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ProductMockups } from "@/components/marketing/product-mockups";
import { AuthHeroBrand } from "@/components/auth/auth-hero-brand";
import { DELETE_ACCOUNT_PATH, HELP_PATH, PRIVACY_PATH, REGULAMIN_PATH } from "@/lib/legal-seller";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";
import { listSubscriptionPlans } from "@/lib/subscription-plans";

/** Cennik z bazy (zmiana ceny w panelu bez wdrożenia) — bez cache statycznego. */
export const dynamic = "force-dynamic";

const TITLE = "GymBrat — dziennik treningowy i żywieniowy";
const DESCRIPTION =
  "Plany treningowe, aktywny trening z timerem, historia i progres, dieta z makroskładnikami oraz raporty sylwetki w jednej aplikacji. Zacznij za darmo.";

export const metadata: Metadata = {
  title: "Start",
  description: DESCRIPTION,
  alternates: { canonical: "/start" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "GymBrat",
    title: TITLE,
    description: DESCRIPTION,
    url: "/start",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FEATURES = [
  { title: "Plany treningowe", text: "Ułóż dni planu z katalogu ćwiczeń albo utwórz plan z ostatnich treningów." },
  { title: "Aktywny trening", text: "Serie, powtórzenia, ciężar i timer przerw w jednym ekranie." },
  { title: "Historia i progres", text: "Tonaż, rekordy i trendy — widzisz, co faktycznie rośnie." },
  { title: "Dieta i makro", text: "Dziennik posiłków, plan żywienia i bilans makroskładników." },
  { title: "Raporty sylwetki", text: "Waga, wymiary i zdjęcia w jednym miejscu, przechowywane tylko dla Ciebie." },
  { title: "Społeczność", text: "Zespoły, wyzwania i wspólne treningi — opcjonalnie." },
];

async function loadPlans() {
  try {
    return await listSubscriptionPlans({ activeOnly: true });
  } catch {
    return [];
  }
}

export default async function StartPage() {
  const plans = await loadPlans();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-16 pt-6">
      <AuthHeroBrand
        headline="Trenuj mądrzej z GymBrat"
        support="Dziennik treningowy i żywieniowy: plany, historia, raporty."
        compact
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/register"
          className="gold-btn inline-flex h-12 flex-1 items-center justify-center rounded-full text-sm"
        >
          Załóż konto
        </Link>
        <Link
          href="/login"
          className="gym-tap inline-flex h-12 flex-1 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white"
        >
          Mam już konto
        </Link>
      </div>

      <section aria-labelledby="funkcje" className="space-y-3">
        <h2 id="funkcje" className="text-lg font-semibold text-white">
          Co dostajesz
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="app-card p-4">
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-white/65">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ekrany" className="space-y-3">
        <h2 id="ekrany" className="text-lg font-semibold text-white">
          Jak to wygląda
        </h2>
        <ProductMockups />
      </section>

      {plans.length > 0 ? (
        <section aria-labelledby="cennik" className="space-y-3">
          <h2 id="cennik" className="text-lg font-semibold text-white">
            Cennik pakietów
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => (
              <li key={p.sku} className="app-card p-4">
                <p className="text-sm font-semibold text-white">{p.title}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--gym-gold)]">
                  {formatPlnFromGrosze(p.priceGrosze)}
                </p>
                <p className="text-[12px] text-white/55">na {p.days} dni</p>
                {p.description ? (
                  <p className="mt-2 text-[13px] leading-snug text-white/65">{p.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-[12px] leading-snug text-white/55">
            Ceny brutto. Pakiet kupisz po zalogowaniu, w zakładce Pakiet. Szczegóły w{" "}
            <Link href={REGULAMIN_PATH} className="underline">
              regulaminie
            </Link>
            .
          </p>
        </section>
      ) : null}

      <nav
        aria-label="Informacje prawne i pomoc"
        className="flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[13px] text-white/60"
      >
        <Link href={REGULAMIN_PATH} className="underline">Regulamin</Link>
        <Link href={PRIVACY_PATH} className="underline">Polityka prywatności</Link>
        <Link href={HELP_PATH} className="underline">Pomoc</Link>
        <Link href={DELETE_ACCOUNT_PATH} className="underline">Usuwanie konta</Link>
      </nav>
    </div>
  );
}

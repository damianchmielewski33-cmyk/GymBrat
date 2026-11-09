import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { InlineBanner } from "@/components/ui/inline-banner";
import { fetchGisAlerts, GIS_DEFAULT_FEED_URL } from "@/lib/gis-alerts";

export const metadata = { title: "Alerty GIS" };

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(iso));
}

export default async function GisAlertsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/meal-suggestions/alerty-gis");

  const { ok, alerts } = await fetchGisAlerts();

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-4">
      <Link
        href="/meal-suggestions"
        className="inline-flex h-11 items-center gap-0.5 text-[15px] font-medium text-white/90"
      >
        <ChevronLeft className="h-6 w-6" aria-hidden /> Wróć
      </Link>
      <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-white">Alerty GIS</h1>
      <p className="mt-1 text-[13px] text-white/60">
        Publiczne ostrzeżenia konsumenckie i wycofania produktów ze sklepów publikowane przez Główny
        Inspektorat Sanitarny. Dane odświeżamy co kilka godzin.
      </p>

      <div className="mt-5 space-y-3" aria-live="polite">
        {!ok ? (
          <InlineBanner variant="warning">
            Nie udało się pobrać alertów GIS. Spróbuj ponownie później lub sprawdź stronę GIS bezpośrednio.
          </InlineBanner>
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[18px] border border-white/[0.08] bg-[#161616] px-4 py-4 text-[14px] text-white/70">
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-300" aria-hidden />
            Brak aktywnych ostrzeżeń w pobranym źródle.
          </div>
        ) : (
          alerts.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-[18px] border border-white/[0.08] bg-[#161616] px-4 py-3.5"
            >
              <p className="text-[14px] font-medium leading-snug text-white">{a.title}</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-white/50">
                {fmtDate(a.publishedAt) ?? "gov.pl/web/gis"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </p>
            </a>
          ))
        )}
      </div>

      <a
        href={GIS_DEFAULT_FEED_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-[44px] items-center text-[12px] text-white/50 underline underline-offset-2"
      >
        Źródło: Główny Inspektorat Sanitarny (gov.pl)
      </a>
    </main>
  );
}

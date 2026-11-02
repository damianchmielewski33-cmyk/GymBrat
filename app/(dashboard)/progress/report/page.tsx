import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { PrintButton } from "@/components/package/print-button";
import { AppError } from "@/lib/errors/app-error";
import { getPremiumReport } from "@/lib/premium-report-access";

const nf = (n: number | null, unit: string) =>
  n == null ? "—" : `${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} ${unit}`;

export default async function PremiumReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/progress/report");

  let report;
  try {
    report = await getPremiumReport(session.user.id);
  } catch (e) {
    if (e instanceof AppError && e.code === "PREMIUM_REQUIRED") {
      return (
        <div className="space-y-4">
          <AppPageHeader kicker="Premium" title="Raport postępów" />
          <div className="app-card space-y-3 p-5 text-sm text-white/75">
            <p>Szczegółowy raport postępów do wydruku lub zapisu jako PDF jest dostępny w pakiecie Premium.</p>
            <Link href="/package" className="inline-block text-[var(--gym-gold)] underline">
              Zobacz pakiety
            </Link>
          </div>
        </div>
      );
    }
    throw e;
  }

  return (
    <div className="space-y-4">
      <AppPageHeader kicker="Premium" title="Raport postępów" description={`Wygenerowano ${new Date(report.generatedAt).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })}`} />
      <section className="app-card space-y-2 p-5 text-sm text-white/85 print:text-black">
        <h2 className="font-semibold">Siła</h2>
        <p>
          Treningi siłowe: {report.strength.workoutCount}
          {report.strength.sinceDate ? ` (od ${report.strength.sinceDate})` : ""} · seria tygodni:{" "}
          {report.strength.streakWeeks}
        </p>
        <p>
          Objętość ćwiczeń: ↑ {report.strength.volumeCounts.up} · → {report.strength.volumeCounts.flat} · ↓{" "}
          {report.strength.volumeCounts.down}
        </p>
        {report.strength.topMaxes.length > 0 ? (
          <ul className="list-disc pl-5">
            {report.strength.topMaxes.map((m) => (
              <li key={m.name}>
                {m.name}: e1RM {nf(m.e1rm, "kg")} ({m.weight} kg × {m.reps}, {m.date}
                {m.isNew ? ", nowy rekord" : ""})
              </li>
            ))}
          </ul>
        ) : (
          <p>Brak danych o maksach.</p>
        )}
      </section>
      <section className="app-card space-y-2 p-5 text-sm text-white/85 print:text-black">
        <h2 className="font-semibold">Ostatnie tygodnie</h2>
        <ul className="space-y-1">
          {report.weeks.map((w) => (
            <li key={w.label}>
              {w.label}: {w.workouts} tren. · {nf(w.tonnageKg, "kg")} · kardio {w.cardioMinutes} min
            </li>
          ))}
        </ul>
      </section>
      {report.body ? (
        <section className="app-card space-y-2 p-5 text-sm text-white/85 print:text-black">
          <h2 className="font-semibold">Ciało</h2>
          <p>
            Waga: {nf(report.body.currentKg, "kg")} (start {nf(report.body.startKg, "kg")}, zmiana{" "}
            {nf(report.body.deltaFromStartKg, "kg")}, tempo {nf(report.body.kgPerWeekLast6, "kg/tydz.")})
          </p>
          <ul>
            {report.body.measures.map((m) => (
              <li key={m.label}>
                {m.label}: {nf(m.currentCm, "cm")} (zmiana {nf(m.deltaFromStartCm, "cm")})
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-[12px] text-white/50">
          Sekcja o ciele jest pominięta — włącz zgodę na dane o ciele w Profilu → Konto.
        </p>
      )}
      <PrintButton />
    </div>
  );
}

import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { BodyReportImport } from "@/components/reports/body-report-import";
import { BodyReportForm } from "@/components/reports/body-report-form";
import { BodyReportHistory } from "@/components/reports/body-report-history";
import { QueuedWorkoutBanner } from "@/components/reports/queued-workout-banner";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";
import { InlineBanner } from "@/components/ui/inline-banner";
import { getBodyReports } from "@/lib/body-reports";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function daysUntilNextReport(
  latest: Date | null,
  cadenceDays: number,
): number | null {
  if (!latest) return null;
  const next = new Date(latest);
  next.setDate(next.getDate() + cadenceDays);
  return Math.ceil((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default async function ReportsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const db = getDb();
  const [reports, settingsRow] = await Promise.all([
    getBodyReports(userId),
    db
      .select({ reportCadenceDays: userSettings.reportCadenceDays })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);
  const cadenceDays = Math.min(
    90,
    Math.max(3, settingsRow?.reportCadenceDays ?? 14),
  );
  const latest = reports[0]?.createdAt ?? null;
  const daysUntilNext = daysUntilNextReport(latest, cadenceDays);
  const lastHints = reports[0]
    ? {
        weightKg: reports[0].weightKg,
        waistCm: reports[0].waistCm,
        chestCm: reports[0].chestCm,
        thighCm: reports[0].thighCm,
        armCm: reports[0].armCm,
        dayEnergy: reports[0].dayEnergy,
        trainingEnergy: reports[0].trainingEnergy,
        digestionScore: reports[0].digestionScore,
        sleepQuality: reports[0].sleepQuality,
        cardioCompliance: reports[0].cardioCompliance,
        dietCompliance: reports[0].dietCompliance,
        trainingCompliance: reports[0].trainingCompliance,
      }
    : null;

  return (
    <div className="theme-black-gold space-y-6">
      <Suspense fallback={null}>
        <QueuedWorkoutBanner />
      </Suspense>
      <WorkoutCompletePopup />

      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4af37]/85">
          Raporty
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">
          Dodaj{" "}
          <span className="bg-gradient-to-r from-[#e8c547] to-[#d4af37] bg-clip-text text-transparent">
            raport
          </span>
        </h1>
        <p className="text-sm text-white/45">
          Wypełnij pomiary i samopoczucie — historia oraz eksport są niżej.
          {daysUntilNext != null ? (
            <>
              {" "}
              Kolejny wg cyklu ({cadenceDays} dni):{" "}
              {daysUntilNext <= 0 ? "teraz" : `za ${daysUntilNext} dni`}.
            </>
          ) : null}
        </p>
      </header>

      <Suspense
        fallback={
          <div className="rounded-3xl border border-white/10 bg-[#141416]/90 p-6 text-sm text-white/50">
            Ładowanie formularza raportu…
          </div>
        }
      >
        <BodyReportForm daysUntilNext={daysUntilNext} lastHints={lastHints} />
      </Suspense>

      <div className="space-y-6 border-t border-white/10 pt-8">
        <header className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4af37]/85">
            Archiwum
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-white">
            Twoje{" "}
            <span className="bg-gradient-to-r from-[#e8c547] to-[#d4af37] bg-clip-text text-transparent">
              raporty
            </span>
          </h2>
        </header>

        <InlineBanner variant="info">
          <strong className="font-semibold text-white/90">Eksport danych.</strong> Pełną kopię
          treningów, raportów i ustawień pobierzesz w formacie JSON lub CSV w{" "}
          <Link href="/profile#export-data" className="text-[#d4af37] underline">
            Profilu (sekcja eksportu)
          </Link>
          .
        </InlineBanner>

        <BodyReportImport />

        <BodyReportHistory
          reports={reports.map((r) => ({
            id: r.id,
            createdAt: r.createdAt.toISOString(),
            weightKg: r.weightKg,
            waistCm: r.waistCm,
            chestCm: r.chestCm,
            thighCm: r.thighCm,
            armCm: r.armCm,
            abdomenCm: r.abdomenCm,
            trainingEnergy: r.trainingEnergy,
            sleepQuality: r.sleepQuality,
            dayEnergy: r.dayEnergy,
            digestionScore: r.digestionScore,
            cardioCompliance: r.cardioCompliance,
            dietCompliance: r.dietCompliance,
            trainingCompliance: r.trainingCompliance,
            photos: r.photos,
          }))}
        />
      </div>
    </div>
  );
}

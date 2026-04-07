import { auth } from "@/auth";
import { BodyReportImport } from "@/components/reports/body-report-import";
import { BodyReportForm } from "@/components/reports/body-report-form";
import { ReportPhotoToggle } from "@/components/reports/report-photo-toggle";
import { getBodyReports } from "@/lib/body-reports";

function formatTakNie(v: string | null) {
  if (v === "tak") return "TAK";
  if (v === "nie") return "NIE";
  return "—";
}

export default async function ReportsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const reports = await getBodyReports(userId);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Dziennik postępów
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Raport
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Dodaj raport z efektów ćwiczeń: pomiary, samopoczucie i zdjęcia sylwetki.
        </p>
      </header>

      <BodyReportImport />

      <BodyReportForm />

      <div className="glass-panel neon-glow overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
            Historia
          </p>
          <h2 className="font-heading mt-1 text-lg font-semibold text-white">
            Ostatnie raporty
          </h2>
        </div>
        {reports.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-white/55">
            Brak raportów — dodaj pierwszy raport powyżej.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {reports.map((r) => (
              <li key={r.id} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/45">
                      {r.createdAt.toLocaleString()}
                    </p>
                    <p className="text-sm text-white/80">
                      {[
                        r.weightKg != null ? `Waga: ${r.weightKg} kg` : null,
                        r.waistCm != null ? `Pas: ${r.waistCm} cm` : null,
                        r.chestCm != null ? `Klatka: ${r.chestCm} cm` : null,
                        r.thighCm != null ? `Udo: ${r.thighCm} cm` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "Brak pomiarów"}
                    </p>
                    <p className="text-xs text-white/55">
                      Dzień: {r.dayEnergy ?? "—"}/10 • Energia treningu:{" "}
                      {r.trainingEnergy ?? "—"}/10 • Trawienie: {r.digestionScore ?? "—"}/10 • Sen:{" "}
                      {r.sleepQuality ?? "—"}/10
                    </p>
                    <p className="text-xs text-white/55">
                      Cardio: {formatTakNie(r.cardioCompliance)} • Dieta:{" "}
                      {formatTakNie(r.dietCompliance)} • Trening (zgodność):{" "}
                      {formatTakNie(r.trainingCompliance)}
                    </p>
                    {r.complianceNotes ? (
                      <p className="text-xs text-white/70">
                        <span className="text-white/45">Niezrealizowane / zakres: </span>
                        {r.complianceNotes}
                      </p>
                    ) : null}
                    {r.additionalInfo ? (
                      <p className="text-xs text-white/70">
                        <span className="text-white/45">Dodatkowo: </span>
                        {r.additionalInfo}
                      </p>
                    ) : null}
                  </div>

                  <ReportPhotoToggle reportId={r.id} photos={r.photos} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

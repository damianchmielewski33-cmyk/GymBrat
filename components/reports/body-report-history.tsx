"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { ReportPhotoToggle } from "@/components/reports/report-photo-toggle";
import { cn } from "@/lib/utils";

export type HistoryReportRow = {
  id: string;
  createdAt: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  armCm: number | null;
  abdomenCm: number | null;
  trainingEnergy: number | null;
  sleepQuality: number | null;
  dayEnergy: number | null;
  digestionScore: number | null;
  cardioCompliance: string | null;
  dietCompliance: string | null;
  trainingCompliance: string | null;
  photos: { id: string; dataUrl: string }[];
};

type Props = {
  reports: HistoryReportRow[];
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "·";
  return String(n).replace(".", ",");
}

function deltaVsPrev(
  current: number | null | undefined,
  prev: number | null | undefined,
): { text: string; trend: "up" | "down" | "flat" | "none" } {
  if (current == null || prev == null || !Number.isFinite(current) || !Number.isFinite(prev)) {
    return { text: "", trend: "none" };
  }
  const d = current - prev;
  if (Math.abs(d) < 0.05) return { text: "0", trend: "flat" };
  const rounded = Math.round(d * 10) / 10;
  const text = `${rounded > 0 ? "+" : ""}${String(rounded).replace(".", ",")}`;
  return { text, trend: rounded > 0 ? "up" : "down" };
}

function TrendMark({ trend }: { trend: "up" | "down" | "flat" | "none" }) {
  if (trend === "none") return null;
  if (trend === "up") return <span aria-hidden className="text-white/55">↗</span>;
  if (trend === "down") return <span aria-hidden className="text-white/55">↘</span>;
  return <span aria-hidden className="text-white/40">→</span>;
}

function scoreColor(n: number | null | undefined): string {
  if (n == null) return "text-white/35";
  if (n >= 8) return "text-emerald-400";
  if (n >= 6) return "text-[#d4af37]";
  return "text-red-400/90";
}

function ComplianceIcon({ value }: { value: string | null }) {
  if (value === "tak") {
    return <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="Tak" />;
  }
  if (value === "nie") {
    return <X className="mx-auto h-4 w-4 text-red-400" aria-label="Nie" />;
  }
  return <span className="text-white/35">·</span>;
}

type HistoryView = "pomiary" | "samopoczucie" | "plan";

export function BodyReportHistory({ reports }: Props) {
  const [view, setView] = useState<HistoryView>("pomiary");

  const chronological = useMemo(
    () =>
      [...reports].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [reports],
  );

  const rows = useMemo(() => {
    return reports.map((r) => {
      const idx = chronological.findIndex((x) => x.id === r.id);
      const prev = idx > 0 ? chronological[idx - 1] : null;
      return {
        report: r,
        weightDelta: deltaVsPrev(r.weightKg, prev?.weightKg),
        waistDelta: deltaVsPrev(r.waistCm, prev?.waistCm),
        thighDelta: deltaVsPrev(r.thighCm, prev?.thighCm),
        chestDelta: deltaVsPrev(r.chestCm, prev?.chestCm),
        armDelta: deltaVsPrev(r.armCm, prev?.armCm),
      };
    });
  }, [reports, chronological]);

  return (
    <div className="theme-black-gold overflow-hidden rounded-3xl border border-white/[0.08] bg-[#161618] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          Historia pomiarów
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d4af37]/85">
          {reports.length} {reports.length === 1 ? "raport" : "raportów"}
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-white/50">
          Brak raportów — dodaj pierwszy powyżej.
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/10 px-3 py-2.5">
            {(
              [
                ["pomiary", "Pomiary"],
                ["samopoczucie", "Samopoczucie"],
                ["plan", "Plan"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition",
                  view === id
                    ? "bg-[#d4af37]/20 text-[#e8c547]"
                    : "text-white/45 hover:bg-white/[0.05] hover:text-white/70",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  <th className="sticky left-0 z-10 bg-[#161618] px-3 py-3 sm:px-4">Data</th>
                  {view === "pomiary" ? (
                    <>
                      <th className="px-3 py-3">Waga</th>
                      <th className="px-3 py-3">Pas</th>
                      <th className="px-3 py-3">Udo</th>
                      <th className="px-3 py-3">Klatka</th>
                      <th className="px-3 py-3">Ramię</th>
                    </>
                  ) : null}
                  {view === "samopoczucie" ? (
                    <>
                      <th className="px-3 py-3">Energia dzień</th>
                      <th className="px-3 py-3">Energia trening</th>
                      <th className="px-3 py-3">Trawienie</th>
                      <th className="px-3 py-3">Sen</th>
                    </>
                  ) : null}
                  {view === "plan" ? (
                    <>
                      <th className="px-3 py-3 text-center">Cardio</th>
                      <th className="px-3 py-3 text-center">Dieta</th>
                      <th className="px-3 py-3 text-center">Trening</th>
                    </>
                  ) : null}
                  <th className="px-3 py-3">Zdjęcia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(
                  ({
                    report: r,
                    weightDelta,
                    waistDelta,
                    thighDelta,
                    chestDelta,
                    armDelta,
                  }) => (
                    <tr key={r.id} className="border-t border-white/[0.06]">
                      <td className="sticky left-0 z-10 bg-[#161618] px-3 py-3 font-medium tabular-nums text-white sm:px-4">
                        {fmtDate(r.createdAt)}
                      </td>
                      {view === "pomiary" ? (
                        <>
                          <MetricCell value={r.weightKg} delta={weightDelta} highlight />
                          <MetricCell value={r.waistCm} delta={waistDelta} highlight />
                          <MetricCell value={r.thighCm} delta={thighDelta} />
                          <MetricCell value={r.chestCm} delta={chestDelta} />
                          <MetricCell value={r.armCm} delta={armDelta} />
                        </>
                      ) : null}
                      {view === "samopoczucie" ? (
                        <>
                          <ScoreCell value={r.dayEnergy} />
                          <ScoreCell value={r.trainingEnergy} />
                          <ScoreCell value={r.digestionScore} />
                          <ScoreCell value={r.sleepQuality} />
                        </>
                      ) : null}
                      {view === "plan" ? (
                        <>
                          <td className="px-3 py-3 text-center">
                            <ComplianceIcon value={r.cardioCompliance} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ComplianceIcon value={r.dietCompliance} />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <ComplianceIcon value={r.trainingCompliance} />
                          </td>
                        </>
                      ) : null}
                      <td className="px-3 py-3">
                        <ReportPhotoToggle reportId={r.id} photos={r.photos} />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCell({
  value,
  delta,
  highlight,
}: {
  value: number | null;
  delta: { text: string; trend: "up" | "down" | "flat" | "none" };
  highlight?: boolean;
}) {
  return (
    <td className="px-3 py-3 tabular-nums">
      <span className={cn("font-semibold", highlight ? "text-[#d4af37]" : "text-white/90")}>
        {fmtNum(value)}
      </span>
      {delta.trend !== "none" ? (
        <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-white/55">
          <TrendMark trend={delta.trend} />
          {delta.text}
        </span>
      ) : null}
    </td>
  );
}

function ScoreCell({ value }: { value: number | null }) {
  return (
    <td className={cn("px-3 py-3 text-center font-semibold tabular-nums", scoreColor(value))}>
      {value == null ? "·" : value}
    </td>
  );
}

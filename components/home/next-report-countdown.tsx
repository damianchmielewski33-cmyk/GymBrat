import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDaysUntilLabel } from "@/lib/body-report-schedule";

function formatLastReport(ymd: string | null) {
  if (!ymd) return null;
  try {
    return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
      new Date(`${ymd}T12:00:00`),
    );
  } catch {
    return ymd;
  }
}

export function NextReportCountdown({
  daysUntil,
  isDue,
  lastReportDateKey,
}: {
  daysUntil: number;
  isDue: boolean;
  lastReportDateKey: string | null;
}) {
  const lastLabel = formatLastReport(lastReportDateKey);
  const unit = formatDaysUntilLabel(daysUntil);

  const hint = !lastReportDateKey
    ? "Brak raportu — dodaj pierwszy pomiar sylwetki."
    : isDue
      ? `Ostatni raport: ${lastLabel}. Czas na kolejny.`
      : `Ostatni raport: ${lastLabel}. Cykl co 7 dni.`;

  return (
    <section className="glass-panel relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(700px_320px_at_90%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white/50">
            <ClipboardList className="h-4 w-4" aria-hidden />
            <p className="text-[11px] font-medium uppercase tracking-[0.22em]">
              Dni do kolejnego raportu
            </p>
          </div>
          <p className="font-heading mt-2 text-3xl font-semibold tabular-nums text-white sm:text-4xl">
            {daysUntil}
            <span className="ml-2 text-lg font-medium text-white/50 sm:text-xl">
              {unit}
            </span>
          </p>
          <p className="mt-1 text-sm text-white/55">{hint}</p>
        </div>
        <Link
          href="/reports"
          className={cn(
            buttonVariants({ variant: isDue ? "cta" : "outline" }),
            "h-12 w-full shrink-0 border-white/20 sm:w-auto sm:min-w-[10.5rem]",
            !isDue && "bg-black/40 text-white hover:bg-white/10",
          )}
        >
          {isDue ? "Dodaj raport" : "Zobacz raporty"}
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function cadenceLabel(days: number): string {
  if (days === 7) return "co tydzień";
  if (days === 14) return "co dwa tygodnie";
  return `co ${days} ${days === 1 ? "dzień" : "dni"}`;
}

export function HomeReportCard({
  firstName,
  daysSinceLastReport,
  reportCadenceDays,
}: {
  firstName: string | null;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
}) {
  const today = calendarDateKey();
  const daysLeft =
    daysSinceLastReport == null
      ? null
      : Math.max(0, reportCadenceDays - daysSinceLastReport);
  const nextDate =
    daysLeft != null ? addCalendarDays(today, daysLeft) : null;
  const lastReportDate =
    daysSinceLastReport != null
      ? addCalendarDays(today, -daysSinceLastReport)
      : null;

  const title =
    daysSinceLastReport == null
      ? "Dodaj pierwszy raport"
      : daysLeft === 0
        ? "Raport na dziś"
        : `Następny za ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"}`;

  const description =
    daysSinceLastReport == null
      ? `Ustaw rytm raportów (domyślnie ${cadenceLabel(reportCadenceDays)}), żeby pilnować wagi i obwodów.`
      : [
          nextDate ? formatLongDate(nextDate) : null,
          cadenceLabel(reportCadenceDays),
          lastReportDate ? `Ostatni ${formatShortDate(lastReportDate)}` : null,
        ]
          .filter(Boolean)
          .join(" · ") +
        ". Możesz wysłać wcześniej — Damian zobaczy go od razu.";

  const nameLabel = firstName?.trim()
    ? `RAPORT DLA ${firstName.trim().toUpperCase()}`
    : "RAPORT SYLWETKI";

  return (
    <section className="app-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {nameLabel}
        </p>
        <ClipboardList
          className="h-4 w-4 shrink-0 text-white/35"
          aria-hidden
        />
      </div>

      <div>
        <h2 className="text-[22px] font-semibold leading-tight text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          {description}
        </p>
      </div>

      <Link
        href="/reports?new=1"
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/20 bg-transparent text-sm font-semibold text-white transition-colors hover:border-white/35 hover:bg-white/[0.04]"
      >
        Wyślij raport
      </Link>

      <Link
        href="/reports"
        className="inline-flex text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]"
      >
        Historia raportów
      </Link>
    </section>
  );
}

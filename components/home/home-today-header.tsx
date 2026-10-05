import { AppMenuButton } from "@/components/layout/app-menu-button";
import { getHomeTodayHeaderData } from "@/lib/home-today-header";
import { calendarDateKey } from "@/lib/local-date";

function initials(firstName: string | null, lastName: string | null): string {
  const a = firstName?.trim()?.[0] ?? "";
  const b = lastName?.trim()?.[0] ?? "";
  const out = `${a}${b}`.toUpperCase();
  return out || "?";
}

function formatHeaderDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d
    .toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .toUpperCase()
    .replace(",", " ·");
}

function daysWord(n: number): string {
  if (n === 1) return "dzień";
  return "dni";
}

/** Lekki nagłówek Pulpitu — osobny stream RSC (szybszy LCP). */
export async function HomeTodayHeader({ userId }: { userId: string }) {
  const data = await getHomeTodayHeaderData(userId);
  const today = calendarDateKey();

  const daysToReport =
    data.daysSinceLastReport == null
      ? null
      : Math.max(0, data.reportCadenceDays - data.daysSinceLastReport);

  const reportCountdownLabel =
    data.daysSinceLastReport == null
      ? "Dodaj pierwszy raport"
      : daysToReport === 0
        ? "Raport na dziś"
        : `${daysToReport} ${daysWord(daysToReport!)} do raportu`;

  const greetingName = data.firstName?.trim() || null;

  return (
    <header className="flex items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]/80">
          {formatHeaderDate(today)}
        </p>
        <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-white">
          Cześć
          {greetingName ? (
            <>
              ,{" "}
              <span className="bg-gradient-to-r from-[var(--gym-gold-bright)] via-[var(--gym-gold)] to-[var(--gym-gold-deep)] bg-clip-text text-transparent">
                {greetingName}
              </span>
            </>
          ) : null}
        </h1>
        <p className="mt-1.5 text-[13px] text-white/45">
          <span className="font-semibold text-white">{reportCountdownLabel}</span>
          {" · "}
          {data.reportCount}{" "}
          {data.reportCount === 1
            ? "raport"
            : data.reportCount >= 2 && data.reportCount <= 4
              ? "raporty"
              : "raportów"}
        </p>
      </div>

      <AppMenuButton
        variant="initials"
        initials={initials(data.firstName, data.lastName)}
      />
    </header>
  );
}

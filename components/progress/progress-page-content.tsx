import Link from "next/link";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { PhotosTab } from "@/components/progress/photos-tab";
import { WeekTab } from "@/components/progress/week-tab";
import { getProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabId } from "@/lib/progress-tabs";

const PL_MONTH = [
  "STYCZNIA",
  "LUTEGO",
  "MARCA",
  "KWIETNIA",
  "MAJA",
  "CZERWCA",
  "LIPCA",
  "SIERPNIA",
  "WRZEŚNIA",
  "PAŹDZIERNIKA",
  "LISTOPADA",
  "GRUDNIA",
] as const;

function formatSinceKicker(iso: string | null, workouts: number): string {
  const tren =
    workouts === 1
      ? "1 TRENING"
      : workouts >= 2 && workouts <= 4
        ? `${workouts} TRENINGI`
        : `${workouts} TRENINGÓW`;
  if (!iso) return tren;
  try {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return tren;
    const month = PL_MONTH[d.getMonth()] ?? "";
    return `OD ${d.getDate()} ${month} · ${tren}`;
  } catch {
    return tren;
  }
}

export async function ProgressPageContent({
  userId,
  tab,
}: {
  userId: string;
  tab: ProgressTabId;
}) {
  let data: Awaited<ReturnType<typeof getProgressHubData>>;
  try {
    data = await getProgressHubData(userId);
  } catch (e) {
    console.error(
      "[progress-hub]",
      e instanceof Error ? e.message : e,
    );
    return (
      <div className="app-panel space-y-4 px-4 py-5 text-center">
        <p className="text-[15px] font-semibold text-white">
          Nie udało się wczytać analizy
        </p>
        <p className="text-[13px] leading-snug text-white/55">
          Chwilowy problem z bazą lub hostingu. Odśwież stronę za chwilę —
          treningi i zdjęcia są bezpieczne.
        </p>
        <Link
          href={`/progress?tab=${encodeURIComponent(tab)}`}
          className="gym-btn-primary inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold"
        >
          Odśwież analizę
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {formatSinceKicker(data.strength.sinceDate, data.strength.workoutCount)}
      </p>

      {tab === "sila" ? <StrengthTab data={data.strength} /> : null}
      {tab === "sylwetka" ? <BodyTab data={data.body} /> : null}
      {tab === "zdjecia" ? <PhotosTab data={data.photos} /> : null}
      {tab === "tydzien" ? <WeekTab data={data.week} /> : null}
    </div>
  );
}

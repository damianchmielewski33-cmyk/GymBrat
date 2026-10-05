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
    return `OD ${d.getDate()} ${month} • ${tren}`;
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
  const data = await getProgressHubData(userId);

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 px-0.5">
        {formatSinceKicker(data.strength.sinceDate, data.strength.workoutCount)}
      </p>

      {tab === "sila" ? <StrengthTab data={data.strength} /> : null}
      {tab === "sylwetka" ? <BodyTab data={data.body} /> : null}
      {tab === "zdjecia" ? <PhotosTab data={data.photos} /> : null}
      {tab === "tydzien" ? <WeekTab data={data.week} /> : null}
    </>
  );
}

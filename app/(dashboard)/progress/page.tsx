import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { PhotosTab } from "@/components/progress/photos-tab";
import { WeekTab } from "@/components/progress/week-tab";
import { getProgressHubData } from "@/lib/progress-hub";
import { parseProgressTab } from "@/lib/progress-tabs";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";

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

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress");

  const sp = await searchParams;
  const tab = parseProgressTab(sp?.tab);
  const data = await getProgressHubData(userId);

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-8">
      <Link
        href="/workout-plan"
        className="inline-flex items-center gap-1.5 text-sm text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </Link>

      <header className="space-y-1 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {formatSinceKicker(
            data.strength.sinceDate,
            data.strength.workoutCount,
          )}
        </p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
          Postępy
        </h1>
      </header>

      <ProgressTabs active={tab} />

      {tab === "sila" ? <StrengthTab data={data.strength} /> : null}
      {tab === "sylwetka" ? <BodyTab data={data.body} /> : null}
      {tab === "zdjecia" ? <PhotosTab data={data.photos} /> : null}
      {tab === "tydzien" ? <WeekTab data={data.week} /> : null}

      <WorkoutCompletePopup />
    </div>
  );
}

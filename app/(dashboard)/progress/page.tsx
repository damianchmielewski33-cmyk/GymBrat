import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { StrengthTab } from "@/components/progress/strength-tab";
import { BodyTab } from "@/components/progress/body-tab";
import { PhotosTab } from "@/components/progress/photos-tab";
import { WeekTab } from "@/components/progress/week-tab";
import { getProgressHubData } from "@/lib/progress-hub";
import { parseProgressTab } from "@/lib/progress-tabs";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";

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
    <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
      <AppPageHeader
        kicker="Postępy"
        title="Hub"
        description="Siła, sylwetka, zdjęcia i tydzień — w jednym miejscu."
      />

      <ProgressTabs active={tab} />

      {tab === "sila" ? <StrengthTab data={data.strength} /> : null}
      {tab === "sylwetka" ? <BodyTab data={data.body} /> : null}
      {tab === "zdjecia" ? <PhotosTab data={data.photos} /> : null}
      {tab === "tydzien" ? <WeekTab data={data.week} /> : null}

      <WorkoutCompletePopup />
    </div>
  );
}

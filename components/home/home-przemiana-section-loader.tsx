import { HomePrzemianaSection } from "@/components/home/home-przemiana-section";
import { getTransformationPhotos } from "@/lib/home-start";

/** Sekcja Przemiana — osobny stream (bez odszyfrowywania zdjęć w głównym dashboardzie). */
export async function HomePrzemianaSectionLoader({
  userId,
  weightFromStartKg,
}: {
  userId: string;
  weightFromStartKg: number | null;
}) {
  const transformation = await getTransformationPhotos(userId);

  return (
    <HomePrzemianaSection
      firstPhotoUrl={transformation.firstPhotoUrl}
      latestPhotoUrl={transformation.latestPhotoUrl}
      latestPhotoDate={transformation.latestPhotoDate}
      weightFromStartKg={weightFromStartKg}
    />
  );
}

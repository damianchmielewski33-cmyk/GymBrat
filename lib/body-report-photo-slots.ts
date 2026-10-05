/**
 * Kolejność zapisu w raporcie: przód → bok → tył (zob. PHOTO_SLOTS w body-report-form).
 */
export const BODY_REPORT_FRONT_PHOTO_INDEX = 0;

export type BodyReportPhotoLike = {
  id: string;
  dataUrl: string;
  createdAt?: Date | null;
};

export function sortBodyReportPhotos<T extends BodyReportPhotoLike>(
  photos: T[],
): T[] {
  return [...photos].sort((a, b) => {
    const ta =
      a.createdAt instanceof Date && !Number.isNaN(a.createdAt.getTime())
        ? a.createdAt.getTime()
        : 0;
    const tb =
      b.createdAt instanceof Date && !Number.isNaN(b.createdAt.getTime())
        ? b.createdAt.getTime()
        : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/** Zdjęcie „przód” z jednego raportu (pierwsze w kolejności zapisu). */
export function frontBodyReportPhoto<T extends BodyReportPhotoLike>(
  photos: T[],
): T | null {
  const sorted = sortBodyReportPhotos(photos);
  if (sorted.length === 0) return null;
  return sorted[BODY_REPORT_FRONT_PHOTO_INDEX] ?? sorted[0] ?? null;
}

export function frontBodyReportPhotoDataUrl(
  photos: BodyReportPhotoLike[],
): string | null {
  const url = frontBodyReportPhoto(photos)?.dataUrl?.trim();
  return url || null;
}

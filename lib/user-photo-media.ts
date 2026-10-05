/** Publiczne URL-e zdjęć użytkownika — blob serwowany po auth, bez data URL w RSC. */

export function bodyReportPhotoMediaPath(photoId: string): string {
  return `/api/media/body-report-photo/${encodeURIComponent(photoId)}`;
}

export function startPhotoMediaPath(): string {
  return "/api/media/start-photo";
}

export function cardioDevicePhotoMediaPath(workoutId: string): string {
  return `/api/media/cardio-photo/${encodeURIComponent(workoutId)}`;
}

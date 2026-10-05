/** Po zapisie treningu — odśwież RSC na pulpicie / historii (Router Cache + prefetch). */
export const WORKOUT_DATA_STALE_KEY = "gymbrat:workoutDataStale";

export function markWorkoutDataStaleForRouter() {
  try {
    sessionStorage.setItem(WORKOUT_DATA_STALE_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

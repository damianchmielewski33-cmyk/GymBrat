/**
 * Kolejka propozycji treningów:
 * 1) nigdy nie robione,
 * 2) robione najdawniej,
 * 3) robione ostatnio — na końcu.
 */
export function comparePlansByWorkoutRecencyAsc(
  a: { lastWorkoutDate: string | null; updatedAt?: string },
  b: { lastWorkoutDate: string | null; updatedAt?: string },
): number {
  if (a.lastWorkoutDate && b.lastWorkoutDate) {
    return a.lastWorkoutDate.localeCompare(b.lastWorkoutDate);
  }
  if (!a.lastWorkoutDate && b.lastWorkoutDate) return -1;
  if (a.lastWorkoutDate && !b.lastWorkoutDate) return 1;
  const au = a.updatedAt ?? "";
  const bu = b.updatedAt ?? "";
  return bu.localeCompare(au);
}

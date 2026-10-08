/** Pola z rejestracji e-mail, których Google OAuth nie zbiera. */
export type BodyProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  activityLevel?: string | null;
};

export function isUserBodyProfileComplete(u: BodyProfileFields): boolean {
  const first = typeof u.firstName === "string" ? u.firstName.trim() : "";
  const last = typeof u.lastName === "string" ? u.lastName.trim() : "";
  const weight =
    typeof u.weightKg === "number" && Number.isFinite(u.weightKg)
      ? u.weightKg
      : null;
  const height =
    typeof u.heightCm === "number" && Number.isFinite(u.heightCm)
      ? u.heightCm
      : null;
  const age =
    typeof u.age === "number" && Number.isFinite(u.age) ? u.age : null;
  const activity =
    typeof u.activityLevel === "string" ? u.activityLevel.trim() : "";

  return (
    first.length > 0 &&
    last.length > 0 &&
    weight != null &&
    weight >= 30 &&
    weight <= 400 &&
    height != null &&
    height >= 100 &&
    height <= 250 &&
    age != null &&
    age >= 13 &&
    age <= 120 &&
    (activity === "low" || activity === "medium" || activity === "high")
  );
}

export const COMPLETE_PROFILE_PATH = "/complete-profile";

export function isCompleteProfilePath(pathname: string): boolean {
  return pathname === COMPLETE_PROFILE_PATH;
}

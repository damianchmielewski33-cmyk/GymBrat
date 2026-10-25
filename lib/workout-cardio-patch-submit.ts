/**
 * Klient lekkiego zapisu cardio po tym, jak trening jest już zapisany (ADR 0004 p.2).
 * Wartości absolutne (cały nowy stan), nie delty. 0 minut usuwa cały obiekt cardio.
 */
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { UserMessages } from "@/lib/user-facing-errors";

export type CardioPatchInput = {
  distanceKm?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  steps?: number | null;
  paceMinPerKm?: number | null;
  cardioType?: string | null;
  effortScore?: number | null;
  heartRateZone?: number | null;
};

export type CardioPatchResult =
  | { status: "ok"; cardioMinutes: number }
  | { status: "not-found" }
  | { status: "error"; message: string };

export async function patchWorkoutCardio(
  workoutId: string,
  input: { cardioMinutes: number; cardio: CardioPatchInput | null },
): Promise<CardioPatchResult> {
  try {
    await ensureCsrfCookie();
    const res = await fetch(`/api/workouts/${encodeURIComponent(workoutId)}/cardio`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...getXsrfHeaders(),
      },
      body: JSON.stringify(input),
    });
    if (res.status === 404) return { status: "not-found" };
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      cardioMinutes?: number;
    } | null;
    if (!res.ok || !data?.ok) {
      return {
        status: "error",
        message:
          typeof data?.error === "string" && data.error.length > 0 && data.error.length < 200
            ? data.error
            : "Nie udało się zapisać cardio. Spróbuj ponownie.",
      };
    }
    return {
      status: "ok",
      cardioMinutes:
        typeof data.cardioMinutes === "number" ? data.cardioMinutes : input.cardioMinutes,
    };
  } catch {
    return { status: "error", message: UserMessages.networkOrServer };
  }
}

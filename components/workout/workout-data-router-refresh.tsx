"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WORKOUT_DATA_STALE_KEY } from "@/lib/workout-data-stale";

function pathNeedsWorkoutDataRefresh(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/workout-history")) return true;
  if (pathname.startsWith("/workout-plan")) return true;
  if (pathname.startsWith("/progress")) return true;
  if (pathname.startsWith("/reports")) return true;
  return false;
}

export function WorkoutDataRouterRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathNeedsWorkoutDataRefresh(pathname)) return;
    try {
      if (sessionStorage.getItem(WORKOUT_DATA_STALE_KEY) !== "1") return;
      sessionStorage.removeItem(WORKOUT_DATA_STALE_KEY);
    } catch {
      /* still refresh below */
    }
    router.refresh();
  }, [pathname, router]);

  return null;
}

"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type PlanFilterKey = string | "all";

/**
 * Stan filtra dnia planu i deep-linku `open` w URL (`?plan=` / `?open=`).
 * `replace` bez scrolla — bez przeładowania RSC przy kliknięciu chipa.
 * URL jest źródłem prawdy (bez synchronizacji useEffect → setState).
 */
export function useWorkoutHistoryFilter(opts: {
  initialPlanKey?: string | null;
  initialOpenId?: string | null;
  knownPlanIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const planFromUrl = searchParams.get("plan") ?? opts.initialPlanKey ?? null;
  const openId = searchParams.get("open") ?? opts.initialOpenId ?? null;

  const filterPlanKey = useMemo<PlanFilterKey>(() => {
    if (!planFromUrl || planFromUrl === "all") return "all";
    return opts.knownPlanIds.includes(planFromUrl) ? planFromUrl : "all";
  }, [planFromUrl, opts.knownPlanIds]);

  const replaceQuery = useCallback(
    (next: { plan?: PlanFilterKey; open?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const plan = next.plan ?? filterPlanKey;
      if (plan === "all") params.delete("plan");
      else params.set("plan", plan);

      if (next.open === undefined) {
        /* keep */
      } else if (next.open) {
        params.set("open", next.open);
      } else {
        params.delete("open");
      }

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filterPlanKey, pathname, router, searchParams],
  );

  const setFilterPlanKey = useCallback(
    (key: PlanFilterKey) => {
      replaceQuery({ plan: key });
    },
    [replaceQuery],
  );

  const clearOpen = useCallback(() => {
    replaceQuery({ open: null });
  }, [replaceQuery]);

  return {
    filterPlanKey,
    setFilterPlanKey,
    openId,
    clearOpen,
  };
}

/**
 * Soft HR adjustments — nigdy nie wywołują deloadu samodzielnie.
 */

export type HrAdjust = {
  readinessDelta: number;
  confidenceDelta: number;
  note: string | null;
};

/**
 * recoveryHR vs restingHR:
 * - bardzo dobra regeneracja → lekki +readiness
 * - słaba → −readiness / −confidence
 */
export function hrReadinessAdjust(args: {
  restingHR?: number | null;
  recoveryHR?: number | null;
  heartRate?: number | null;
}): HrAdjust {
  const rest = args.restingHR;
  const rec = args.recoveryHR ?? args.heartRate;
  if (
    rest == null ||
    rec == null ||
    !Number.isFinite(rest) ||
    !Number.isFinite(rec) ||
    rest <= 0 ||
    rec <= 0
  ) {
    return { readinessDelta: 0, confidenceDelta: 0, note: null };
  }

  // recovery blisko resting = dobra regeneracja
  const ratio = rec / rest;
  if (ratio <= 1.15) {
    return {
      readinessDelta: 4,
      confidenceDelta: 2,
      note: "dobra regeneracja HR",
    };
  }
  if (ratio <= 1.35) {
    return { readinessDelta: 0, confidenceDelta: 0, note: null };
  }
  if (ratio <= 1.55) {
    return {
      readinessDelta: -6,
      confidenceDelta: -4,
      note: "słabsza regeneracja HR",
    };
  }
  return {
    readinessDelta: -12,
    confidenceDelta: -8,
    note: "słaba regeneracja HR",
  };
}

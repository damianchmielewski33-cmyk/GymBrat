/**
 * Jedna definicja „startu” dla Przeglądu, Sylwetki i Zdjęć (ADR 0008 §3.3 / BR-4).
 */

export type ProgressStart = {
  date: string | null;
  weightKg: number | null;
  waistCm: number | null;
  /** Start z ręcznie wybranego zdjęcia startowego (galeria), nie z pierwszego pomiaru. */
  isCustomPhotoStart: boolean;
};

export function resolveProgressStart(input: {
  weights: ReadonlyArray<{ date: string; kg: number }>;
  hasCustomStartPhoto: boolean;
  customStartPhoto: {
    date: string;
    weightKg: number | null;
    waistCm: number | null;
  } | null;
  firstReportWithPhoto: {
    date: string;
    weightKg: number | null;
    waistCm: number | null;
  } | null;
}): ProgressStart {
  if (input.hasCustomStartPhoto && input.customStartPhoto) {
    const photo = input.customStartPhoto;
    const weightKg =
      photo.weightKg ??
      weightOnOrBefore(input.weights, photo.date) ??
      input.weights[0]?.kg ??
      null;
    return {
      date: photo.date,
      weightKg,
      waistCm: photo.waistCm,
      isCustomPhotoStart: true,
    };
  }

  if (input.firstReportWithPhoto) {
    const photo = input.firstReportWithPhoto;
    const weightKg =
      photo.weightKg ??
      weightOnOrBefore(input.weights, photo.date) ??
      input.weights[0]?.kg ??
      null;
    return {
      date: photo.date,
      weightKg,
      waistCm: photo.waistCm,
      isCustomPhotoStart: false,
    };
  }

  const first = input.weights[0];
  if (!first) {
    return {
      date: null,
      weightKg: null,
      waistCm: null,
      isCustomPhotoStart: false,
    };
  }
  return {
    date: first.date,
    weightKg: first.kg,
    waistCm: null,
    isCustomPhotoStart: false,
  };
}

function weightOnOrBefore(
  weights: ReadonlyArray<{ date: string; kg: number }>,
  date: string,
): number | null {
  let best: number | null = null;
  for (const w of weights) {
    if (w.date <= date) best = w.kg;
    else break;
  }
  return best;
}

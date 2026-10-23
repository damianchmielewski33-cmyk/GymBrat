/**
 * Autoregulated bump sizes — nadal respektuje double progression.
 */

import type { MovementKind } from "@/lib/exercise-movement-kind";
import { DEFAULT_WEIGHT_STEP, type WeightStep } from "@/lib/weight-step";
import type {
  ProgressionBump,
  ProgressionBumpKind,
  ReadinessBand,
} from "@/lib/live-coach/types";

export function readinessBand(score: number): ReadinessBand {
  if (score >= 90) return "progress_ready";
  if (score >= 70) return "normal";
  if (score >= 50) return "conservative";
  if (score >= 30) return "hold";
  return "deload_consider";
}

export function resolveProgressionBump(args: {
  readiness: number;
  confidence: number;
  movementKind?: MovementKind;
  /** Czy reguła double progression w ogóle pozwala na +kg. */
  allowWeightBump: boolean;
  /** Krok ćwiczenia / sprzętu (domyślnie 2,5 kg, mikro 1,25 kg). */
  weightStep?: WeightStep;
}): ProgressionBump {
  const step = args.weightStep ?? DEFAULT_WEIGHT_STEP;
  if (!args.allowWeightBump) {
    return { kind: "hold", stepKg: 0 };
  }

  const band = readinessBand(args.readiness);
  const iso = args.movementKind === "isolation";

  if (band === "deload_consider" || band === "hold") {
    return { kind: "hold", stepKg: 0 };
  }

  if (band === "conservative" || args.confidence < 55) {
    return {
      kind: "minimum",
      stepKg: iso ? step.minStepKg : step.stepKg,
    };
  }

  if (
    band === "progress_ready" &&
    args.confidence >= 90 &&
    args.readiness >= 95
  ) {
    return {
      kind: "aggressive",
      stepKg: iso ? step.stepKg : step.stepKg * 2,
    };
  }

  return {
    kind: "normal",
    stepKg: step.stepKg,
  };
}

export function bumpKindLabel(kind: ProgressionBumpKind): string {
  switch (kind) {
    case "aggressive":
      return "agresywna dokładka";
    case "normal":
      return "standardowa dokładka";
    case "minimum":
      return "ostrożna dokładka";
    case "deload":
      return "deload";
    default:
      return "utrzymaj";
  }
}

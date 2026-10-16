/**
 * Autoregulated bump sizes — nadal respektuje double progression.
 */

import type { MovementKind } from "@/lib/exercise-movement-kind";
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
}): ProgressionBump {
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
      stepKg: iso ? 1.25 : 2.5,
    };
  }

  if (
    band === "progress_ready" &&
    args.confidence >= 90 &&
    args.readiness >= 95
  ) {
    return {
      kind: "aggressive",
      stepKg: iso ? 2.5 : 5,
    };
  }

  return {
    kind: "normal",
    stepKg: 2.5,
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

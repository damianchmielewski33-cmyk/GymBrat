export function predictOutcome(input: {
  timeDeltaSeconds: number;
  setsDelta: number;
  progressDeltaPct: number;
  remainingGhostSets: number;
  remainingMyEstimate: number;
}): { kind: "winning" | "trailing" | "neck"; label: string } {
  const score =
    input.setsDelta * 2 +
    input.progressDeltaPct / 10 -
    input.timeDeltaSeconds / 60;

  if (Math.abs(score) < 1.5) {
    return { kind: "neck", label: "Łeb w łeb" };
  }
  if (score > 0) {
    return { kind: "winning", label: "Wygrywasz" };
  }
  return { kind: "trailing", label: "Ghost prowadzi" };
}

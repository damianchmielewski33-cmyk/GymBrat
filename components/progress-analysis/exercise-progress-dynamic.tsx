"use client";

import dynamic from "next/dynamic";

function Loading() {
  return <div className="glass-panel neon-glow h-[360px] animate-pulse" />;
}

const ExerciseProgressClient = dynamic(
  () =>
    import("@/components/progress-analysis/exercise-progress-client").then(
      (m) => m.ExerciseProgressClient,
    ),
  { ssr: false, loading: Loading },
);

export function ExerciseProgressDynamic(props: {
  suggestions: string[];
  defaultQuery?: string | null;
}) {
  return <ExerciseProgressClient {...props} />;
}


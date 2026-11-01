"use client";

import {
  HOF_PERIOD_KINDS,
  HOF_PERIOD_LABELS,
  type HofPeriodKind,
} from "@/lib/community/hof-types";
import { SegmentedControl } from "@/components/progress/progress-ui";

export function HofPeriodTabs({
  kind,
  onChange,
}: {
  kind: HofPeriodKind;
  onChange: (k: HofPeriodKind) => void;
}) {
  return (
    <SegmentedControl
      options={HOF_PERIOD_KINDS.map((k) => ({
        id: k,
        label: HOF_PERIOD_LABELS[k],
      }))}
      value={kind}
      onChange={onChange}
      ariaLabel="Okres Galerii sławy"
    />
  );
}

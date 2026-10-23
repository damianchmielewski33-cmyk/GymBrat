"use client";

import { SegmentedControl } from "@/components/progress/progress-ui";
import { PROGRESS_TABS, type ProgressTabId } from "@/lib/progress-tabs";

export function ProgressTabs({
  active,
  onTabChange,
}: {
  active: ProgressTabId;
  onTabChange: (tab: ProgressTabId) => void;
}) {
  return (
    <SegmentedControl
      options={PROGRESS_TABS}
      value={active}
      onChange={onTabChange}
      ariaLabel="Zakładki postępów"
    />
  );
}

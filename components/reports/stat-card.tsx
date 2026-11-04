import type { LucideIcon } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  className?: string;
};

/** Kafelek metryki raportów — nakładka na `components/ui/stat-tile` (Z67). */
export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <StatTile
      surface="card"
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      className={className ? `p-4 ${className}` : "p-4"}
    />
  );
}

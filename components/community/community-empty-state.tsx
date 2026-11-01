import type { ReactNode } from "react";
import { AppEmptyState } from "@/components/ui/app-empty-state";

export function CommunityEmptyState({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <AppEmptyState
      title={title}
      description={description}
      action={action}
      className={className}
      icon={icon}
    />
  );
}

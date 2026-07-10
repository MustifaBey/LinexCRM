import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state component for when no data is available.
 * Shows an icon, title, description, and optional CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        {icon || <FolderOpen className="w-7 h-7 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

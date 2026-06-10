import { cn } from "@/lib/utils";

type StatusVariant = "safe" | "warning" | "danger" | "info" | "default";

interface StatusIndicatorProps {
  variant: StatusVariant;
  label: string;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<StatusVariant, { dot: string; text: string; bg: string }> = {
  safe: {
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success/10",
  },
  warning: {
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning/10",
  },
  danger: {
    dot: "bg-destructive",
    text: "text-destructive",
    bg: "bg-destructive/10",
  },
  info: {
    dot: "bg-info",
    text: "text-info",
    bg: "bg-info/10",
  },
  default: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted",
  },
};

/**
 * Color-coded status indicator with dot and label.
 * Used for domain expiration, project status, etc.
 */
export function StatusIndicator({
  variant,
  label,
  pulse = false,
  className,
}: StatusIndicatorProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        styles.bg,
        styles.text,
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          styles.dot,
          pulse && "animate-pulse"
        )}
      />
      {label}
    </span>
  );
}

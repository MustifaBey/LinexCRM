import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
}

/**
 * Shimmering skeleton loader for content placeholders
 */
export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div
      className={cn("animate-shimmer rounded-xl", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Card-shaped skeleton for dashboard stat cards
 */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <LoadingSkeleton className="h-4 w-24" />
          <LoadingSkeleton className="h-8 w-16" />
          <LoadingSkeleton className="h-3 w-32" />
        </div>
        <LoadingSkeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-40" : i === columns - 1 ? "w-20" : "w-24"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Full-page loading skeleton
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <LoadingSkeleton className="h-7 w-48" />
        <LoadingSkeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

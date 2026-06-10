"use client";

import { daysUntil } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

interface StatusBadgeProps {
  expirationDate: string | Date;
  autoRenew?: boolean;
  className?: string;
}

export function StatusBadge({ expirationDate, autoRenew = false, className }: StatusBadgeProps) {
  const days = daysUntil(expirationDate);

  let variant: "safe" | "warning" | "danger" = "safe";
  let label = "";
  let icon = <CheckCircle2 className="w-3.5 h-3.5" />;
  let styles = "";

  if (days < 0) {
    variant = "danger";
    label = `Expired (${Math.abs(days)}d ago)`;
    icon = <AlertTriangle className="w-3.5 h-3.5" />;
    styles = "bg-red-950/40 text-red-400 border-red-800/50";
  } else if (days <= 30) {
    variant = "warning";
    label = `${days}d left`;
    icon = <Clock className="w-3.5 h-3.5" />;
    styles = "bg-amber-950/40 text-amber-400 border-amber-800/50 animate-pulse";
  } else {
    variant = "safe";
    label = `${days} days left`;
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    styles = "bg-emerald-950/40 text-emerald-400 border-emerald-800/50";
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        className={cn(
          "px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 shrink-0 select-none",
          styles,
          className
        )}
      >
        {icon}
        <span>{label}</span>
      </div>

      {autoRenew && (
        <div
          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-burgundy/10 border border-burgundy/25 text-burgundy flex items-center gap-1 select-none shrink-0"
          title="Auto-renewal enabled"
        >
          <RefreshCw className="w-3 h-3 animate-spin-slow" />
          <span>Auto</span>
        </div>
      )}
    </div>
  );
}

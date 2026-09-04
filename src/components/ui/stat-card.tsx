import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Context for the number — what it counts, or over what period. */
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  /**
   * Only pass this when a real prior-period figure exists. A tile that invents
   * a trend is worse than a tile without one.
   */
  trend?: { value: number; label: string };
  onClick?: () => void;
  className?: string;
}

const TONE_ICON: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  trend,
  onClick,
  className,
}: StatCardProps) => {
  const interactive = typeof onClick === "function";
  const Wrapper = interactive ? "button" : "div";
  const rising = trend ? trend.value >= 0 : false;
  const TrendIcon = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <Wrapper
      {...(interactive ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex flex-col gap-3 rounded-md border border-border bg-card p-4 text-left shadow-xs",
        interactive &&
          "transition-shadow duration-fast ease-standard hover:border-border-strong hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-sm", TONE_ICON[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="tabular text-2xl font-semibold leading-none text-foreground">{value}</span>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                rising ? "text-success" : "text-danger",
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {Math.abs(trend.value)}%
            </span>
          )}
          {(hint || trend) && (
            <span className="truncate text-xs text-muted-foreground">{trend ? trend.label : hint}</span>
          )}
        </div>
      </div>
    </Wrapper>
  );
};

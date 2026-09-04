import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Say what isn't here yet, in the user's words. */
  title: string;
  /** Explain how to get the first one, or why the list is empty. */
  description?: string;
  action?: React.ReactNode;
  /** `search` is for "nothing matched a filter", which needs different copy. */
  variant?: "empty" | "search";
  className?: string;
}

/**
 * Replaces the blank space a table leaves when it has no rows. An empty screen
 * reads as broken; this reads as a state.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  variant = "empty",
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
      className,
    )}
  >
    {Icon && (
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          variant === "search" ? "bg-muted" : "bg-primary-soft",
        )}
      >
        <Icon
          className={cn("h-5 w-5", variant === "search" ? "text-muted-foreground" : "text-primary")}
          aria-hidden="true"
        />
      </div>
    )}
    <div className="flex max-w-sm flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="mt-1">{action}</div>}
  </div>
);

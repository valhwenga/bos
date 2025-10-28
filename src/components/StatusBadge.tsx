import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "On Hold" | "In Progress" | "Complete" | "Canceled" | "Pending" | "New" | "Won" | "Loss";
  className?: string;
}

const statusStyles = {
  "On Hold": "bg-[hsl(var(--status-hold))] text-white",
  "In Progress": "bg-[hsl(var(--status-progress))] text-white",
  "Complete": "bg-[hsl(var(--status-complete))] text-white",
  "Canceled": "bg-[hsl(var(--status-canceled))] text-white",
  "Pending": "bg-[hsl(var(--status-pending))] text-white",
  "New": "bg-[hsl(var(--status-new))] text-white",
  "Won": "bg-[hsl(var(--status-won))] text-white",
  "Loss": "bg-[hsl(var(--status-loss))] text-white",
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      {status}
    </span>
  );
};

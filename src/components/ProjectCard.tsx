import { CalendarDays } from "lucide-react";
import { Card } from "./ui/card";
import { AvatarGroup } from "./AvatarGroup";
import { cn } from "@/lib/utils";

export type ProjectCardStatus = "Open" | "In Progress" | "Pending" | "Rejected" | "Complete";

const STATUS_TONE: Record<ProjectCardStatus, string> = {
  Open: "bg-muted text-muted-foreground",
  "In Progress": "bg-info-soft text-info",
  Pending: "bg-warning-soft text-warning",
  Rejected: "bg-danger-soft text-danger",
  Complete: "bg-success-soft text-success",
};

interface ProjectCardProps {
  icon: string;
  title: string;
  description: string;
  status: ProjectCardStatus;
  members: { name: string; color?: string }[];
  startDate: string;
  dueDate: string;
  /** Flags an unfinished project past its due date. */
  overdue?: boolean;
}

export const ProjectCard = ({
  icon,
  title,
  description,
  status,
  members,
  startDate,
  dueDate,
  overdue = false,
}: ProjectCardProps) => {
  return (
    <Card className="flex h-full flex-col gap-3 border-border p-4 shadow-xs transition-shadow duration-fast ease-standard hover:border-border-strong hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold uppercase text-primary-foreground">
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          <span className={cn("w-fit rounded-sm px-1.5 py-0.5 text-xs font-medium", STATUS_TONE[status])}>
            {status}
          </span>
        </div>
      </div>

      {description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
      )}

      {/* Only rendered when there are members — this used to show an empty
          "MEMBERS" heading on every card. */}
      {members.length > 0 && <AvatarGroup members={members} />}

      <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-2.5 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Start</span>
          <span className="font-medium text-foreground">{startDate || "—"}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-muted-foreground">Due</span>
          <span className={cn("inline-flex items-center gap-1 font-medium", overdue ? "text-danger" : "text-foreground")}>
            {overdue && <CalendarDays className="h-3 w-3" aria-hidden="true" />}
            {dueDate || "—"}
          </span>
        </div>
      </div>
    </Card>
  );
};

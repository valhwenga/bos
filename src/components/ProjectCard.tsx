import { MoreVertical } from "lucide-react";
import { Card } from "./ui/card";
import { StatusBadge } from "./StatusBadge";
import { AvatarGroup } from "./AvatarGroup";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ProjectCardProps {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  status: "On Hold" | "In Progress" | "Complete" | "Canceled" | "Pending" | "New" | "Won" | "Loss";
  members: { name: string; color?: string }[];
  startDate: string;
  dueDate: string;
}

export const ProjectCard = ({
  icon,
  iconBg,
  title,
  description,
  status,
  members,
  startDate,
  dueDate,
}: ProjectCardProps) => {
  return (
    <Card className="p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <StatusBadge status={status} className="mb-3" />
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{description}</p>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">MEMBERS</p>
        <AvatarGroup members={members} />
      </div>

      <div className="flex justify-between text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Start Date</p>
          <p className="font-medium text-destructive">{startDate}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-1">Due Date</p>
          <p className="font-medium">{dueDate}</p>
        </div>
      </div>
    </Card>
  );
};

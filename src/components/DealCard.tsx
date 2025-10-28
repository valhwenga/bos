import { MoreVertical, MessageSquare, CheckSquare } from "lucide-react";
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

interface DealCardProps {
  title: string;
  status: "On Hold" | "In Progress" | "Complete" | "Canceled" | "Pending" | "New" | "Won" | "Loss";
  amount: string;
  progress?: string;
  tasks?: number;
  comments?: number;
  members: { name: string; color?: string }[];
  statusColors?: string[];
}

export const DealCard = ({
  title,
  status,
  amount,
  progress,
  tasks,
  comments,
  members,
  statusColors = [],
}: DealCardProps) => {
  return (
    <Card className="p-4 mb-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={status} />
          {statusColors.map((color, index) => (
            <span
              key={index}
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white`}
              style={{ backgroundColor: color }}
            >
              {["New", "Pending", "Won"][index] || "Status"}
            </span>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h3 className="font-semibold mb-3">{title}</h3>

      {progress && (
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-muted-foreground">{progress}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-sm mb-3">
        <span className="text-primary font-semibold">{amount}</span>
      </div>

      {(tasks !== undefined || comments !== undefined) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          {tasks !== undefined && (
            <div className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-primary" />
              <span className="text-primary font-medium">{tasks}</span>
            </div>
          )}
          {comments !== undefined && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-primary" />
              <span className="text-primary font-medium">{comments}</span>
            </div>
          )}
        </div>
      )}

      <AvatarGroup members={members} size="sm" />
    </Card>
  );
};

import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";

interface AvatarGroupProps {
  members: { name: string; color?: string }[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

const colors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-teal-500",
];

export const AvatarGroup = ({ members, max = 3, size = "md" }: AvatarGroupProps) => {
  const displayMembers = members.slice(0, max);
  const remaining = members.length - max;

  return (
    <div className="flex -space-x-2">
      {displayMembers.map((member, index) => (
        <Avatar
          key={index}
          className={cn(
            sizeClasses[size],
            "border-2 border-card ring-0"
          )}
        >
          <AvatarFallback className={cn("text-white font-medium", member.color || colors[index % colors.length])}>
            {member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <Avatar className={cn(sizeClasses[size], "border-2 border-card")}>
          <AvatarFallback className="bg-muted text-foreground font-medium">
            +{remaining}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

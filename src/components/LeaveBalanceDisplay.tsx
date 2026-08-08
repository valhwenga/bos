import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeaveBalanceStore } from "@/lib/leaveBalanceStore";

type Props = {
  employeeId: string;
};

export function LeaveBalanceDisplay({ employeeId }: Props) {
  const balances = LeaveBalanceStore.get(employeeId);
  const entries = Object.entries(balances);

  return (
    <Card className="p-4 mt-4">
      <h4 className="font-semibold mb-3">Leave Balances</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(([type, remaining]) => (
          <div key={type} className="flex justify-between items-center">
            <span className="text-sm">{type}</span>
            <Badge variant={remaining > 2 ? "secondary" : "destructive"}>
              {remaining} days
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import { BarChart3, Users, DollarSign, TrendingUp } from "lucide-react";
import { useDashboardMetrics } from "@/lib/metrics";

function fmt(n: number): string { return n.toLocaleString(); }

const Dashboard = () => {
  const m = useDashboardMetrics();
  const stats = [
    { title: "Employees", value: fmt(m.employees), change: "", icon: Users, color: "bg-green-500" },
    { title: "Departments", value: fmt(m.departments), change: "", icon: BarChart3, color: "bg-blue-500" },
    { title: "Open Tickets", value: fmt(m.ticketsOpen), change: "", icon: TrendingUp, color: "bg-orange-500" },
    { title: "SLA Hit Rate", value: `${m.ticketsSlaRate}%`, change: "", icon: DollarSign, color: "bg-purple-500" },
    { title: "Projects", value: fmt(m.projects), change: "", icon: BarChart3, color: "bg-blue-500" },
    { title: "Deals", value: fmt(m.deals), change: "", icon: TrendingUp, color: "bg-orange-500" },
    { title: "Invoices", value: fmt(m.invoices), change: "", icon: DollarSign, color: "bg-purple-500" },
    { title: "Overdue Tickets", value: fmt(m.ticketsOverdue), change: "", icon: TrendingUp, color: "bg-red-500" },
  ];
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Live overview scoped to your role and departments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.change && <span className="text-sm font-medium text-green-600">{stat.change}</span>}
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-start gap-3 pb-4 border-b border-border last:border-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Project Update</p>
                  <p className="text-xs text-muted-foreground">New milestone completed in Website Launch</p>
                  <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Deadlines</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">Website Redesign</p>
                  <p className="text-xs text-muted-foreground">Due in 3 days</p>
                </div>
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "75%" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;


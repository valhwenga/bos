import { useEffect, useMemo, useState } from "react";
import { SupportStore, type Ticket } from "@/lib/supportStore";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [list, setList] = useState<Ticket[]>(SupportStore.list());
  const refresh = () => setList(SupportStore.list());
  useEffect(()=>{ refresh(); }, []);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const t of list) byStatus[t.status] = (byStatus[t.status]||0)+1;
    const overdue = list.filter(t => t.dueAt && (!t.resolvedAt || new Date(t.resolvedAt) > new Date(t.dueAt!))).length;
    const withSla = list.filter(t => t.dueAt).length;
    const slaHit = list.filter(t => t.dueAt && t.resolvedAt && new Date(t.resolvedAt) <= new Date(t.dueAt)).length;
    const slaRate = withSla ? Math.round((slaHit/withSla)*100) : 100;
    return { byStatus, overdue, slaRate };
  }, [list]);

  const navigate = useNavigate();

  const overdueTickets = useMemo(() => list.filter(t => t.dueAt && (!t.resolvedAt || new Date(t.resolvedAt) > new Date(t.dueAt!))).slice(0,8), [list]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Support Dashboard</h1>
          <p className="text-sm text-muted-foreground">SLA metrics and queue overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refresh}>Refresh</Button>
          <Button onClick={()=> navigate('/support/tickets')}>Go to Tickets</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">Open</div>
          <div className="text-3xl font-bold">{counts.byStatus['open']||0}</div>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">In Progress</div>
          <div className="text-3xl font-bold">{counts.byStatus['in_progress']||0}</div>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">Waiting</div>
          <div className="text-3xl font-bold">{counts.byStatus['waiting']||0}</div>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">Pending Approval</div>
          <div className="text-3xl font-bold">{counts.byStatus['pending_approval']||0}</div>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">Resolved</div>
          <div className="text-3xl font-bold">{counts.byStatus['resolved']||0}</div>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">Closed</div>
          <div className="text-3xl font-bold">{counts.byStatus['closed']||0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <div className="text-sm text-muted-foreground mb-1">SLA Hit Rate</div>
          <div className="text-3xl font-bold">{counts.slaRate}%</div>
          <div className="text-xs text-muted-foreground mt-1">% of tickets resolved before SLA due</div>
        </div>
        <div className="bg-card rounded-lg border p-5 md:col-span-2">
          <div className="text-sm text-muted-foreground mb-3">Overdue Tickets</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {overdueTickets.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.id}</td>
                    <td className="p-2">{t.title}</td>
                    <td className="p-2">{t.dueAt && new Date(t.dueAt).toLocaleString()}</td>
                  </tr>
                ))}
                {overdueTickets.length===0 && <tr><td className="p-3 text-muted-foreground" colSpan={3}>No overdue tickets</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

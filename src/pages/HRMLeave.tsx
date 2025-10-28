import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Check, X, Clock, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HRMLeaveStore, type Leave, type LeaveStatus } from "@/lib/hrmLeaveStore";
import { Permissions } from "@/lib/permissions";

const leaveStats = [
  { type: "Total Requests", count: 15, icon: "📝", color: "bg-blue-500" },
  { type: "Pending", count: 2, icon: "⏳", color: "bg-orange-500" },
  { type: "Approved", count: 10, icon: "✅", color: "bg-green-500" },
  { type: "Rejected", count: 3, icon: "❌", color: "bg-red-500" },
];

const statusColors = {
  Pending: "bg-orange-500 text-white",
  Approved: "bg-primary text-white",
  Rejected: "bg-red-500 text-white",
};

export default function HRMLeave() {
  const [leaves, setLeaves] = useState<Leave[]>(HRMLeaveStore.list());
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Leave | null>(null);
  const [action, setAction] = useState<LeaveStatus | null>(null);
  const [managerNote, setManagerNote] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [form, setForm] = useState<{ employee: string; employeeId: string; type: string; startDate: string; endDate: string; reason: string }>({ employee: "", employeeId: "", type: "Sick Leave", startDate: "", endDate: "", reason: "" });
  const canAct = (()=> {
    const r = Permissions.getRole();
    return r === "admin" || r === "manager";
  })();
  const view = (l: Leave) => { setSelected(l); setAction(null); setManagerNote(""); setOpen(true); };
  const approve = (l: Leave) => { if(!canAct) return; setSelected(l); setAction("Approved"); setManagerNote(""); setOpen(true); };
  const reject = (l: Leave) => { if(!canAct) return; setSelected(l); setAction("Rejected"); setManagerNote(""); setOpen(true); };
  const submit = () => {
    if (!selected || !action) { setOpen(false); return; }
    HRMLeaveStore.setStatus(selected.id, action, managerNote);
    setLeaves(HRMLeaveStore.list());
    setOpen(false);
  };
  const apply = () => {
    if (!form.employee.trim() || !form.employeeId.trim() || !form.type.trim() || !form.startDate || !form.endDate) return;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const ms = Math.max(0, end.getTime() - start.getTime());
    const days = Math.floor(ms / (1000*60*60*24)) + 1;
    const l: Leave = { id: `L${Date.now()}`, employee: form.employee, employeeId: form.employeeId, type: form.type, startDate: form.startDate, endDate: form.endDate, days, reason: form.reason, status: "Pending", appliedOn: new Date().toISOString() };
    HRMLeaveStore.upsert(l);
    setLeaves(HRMLeaveStore.list());
    setApplyOpen(false);
    setForm({ employee: "", employeeId: "", type: "Sick Leave", startDate: "", endDate: "", reason: "" });
  };
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Leave Management</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-primary">Leave</span>
          </div>
        </div>

        <Button size="sm" onClick={()=> setApplyOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Apply Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {leaveStats.map((stat, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{stat.type}</span>
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                <span className="text-xl">{stat.icon}</span>
              </div>
            </div>
            <p className="text-3xl font-bold">{stat.count}</p>
          </Card>
        ))}
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select defaultValue="all">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select defaultValue="10">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">EMPLOYEE</th>
                <th className="text-left p-4 font-semibold text-sm">LEAVE TYPE</th>
                <th className="text-left p-4 font-semibold text-sm">START DATE</th>
                <th className="text-left p-4 font-semibold text-sm">END DATE</th>
                <th className="text-left p-4 font-semibold text-sm">DAYS</th>
                <th className="text-left p-4 font-semibold text-sm">REASON</th>
                <th className="text-left p-4 font-semibold text-sm">STATUS</th>
                <th className="text-right p-4 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((request) => (
                <tr key={request.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                          {request.employee.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{request.employee}</p>
                        <p className="text-xs text-muted-foreground">{request.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{request.type}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{new Date(request.startDate).toLocaleDateString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{new Date(request.endDate).toLocaleDateString()}</span>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary">{request.days} {request.days === 1 ? 'day' : 'days'}</Badge>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground line-clamp-2">{request.reason}</span>
                  </td>
                  <td className="p-4">
                    <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                      {request.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={()=> view(request)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    {request.status === "Pending" && canAct && (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={()=> approve(request)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={()=> reject(request)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {request.status !== "Pending" && <Clock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing 1 to 5 of 5 entries</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
              1
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Employee:</span> {selected.employee} ({selected.employeeId})</div>
              <div><span className="text-muted-foreground">Type:</span> {selected.type}</div>
              <div><span className="text-muted-foreground">Dates:</span> {new Date(selected.startDate).toLocaleDateString()} - {new Date(selected.endDate).toLocaleDateString()} ({selected.days} days)</div>
              <div><span className="text-muted-foreground">Reason:</span> {selected.reason}</div>
              <div><span className="text-muted-foreground">Applied:</span> {new Date(selected.appliedOn).toLocaleDateString()}</div>
              {selected.managerNote && <div><span className="text-muted-foreground">Manager Note:</span> {selected.managerNote}</div>}
            </div>
          )}
          {canAct && action && (
            <div className="grid gap-2 mt-3">
              <label className="text-xs text-muted-foreground">Manager Note ({action === 'Rejected' ? 'required' : 'optional'})</label>
              <Input value={managerNote} onChange={(e)=> setManagerNote(e.target.value)} placeholder={action === 'Rejected' ? 'Provide a reason for rejection' : 'Optional note'} />
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Close</Button>
            {canAct && action && <Button onClick={submit} disabled={action==='Rejected' && !managerNote.trim()}>Confirm {action}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Employee</label>
            <Input value={form.employee} onChange={(e)=> setForm({ ...form, employee: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Employee ID</label>
            <Input value={form.employeeId} onChange={(e)=> setForm({ ...form, employeeId: e.target.value })} />
          </div>
          <div className="grid gap-1 md:col-span-2">
            <label className="text-xs text-muted-foreground">Leave Type</label>
            <select className="h-10 rounded-md border bg-background px-3" value={form.type} onChange={(e)=> setForm({ ...form, type: e.target.value })}>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Vacation">Vacation</option>
              <option value="Personal Leave">Personal Leave</option>
              <option value="Casual Leave">Casual Leave</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Start Date</label>
            <Input type="date" value={form.startDate} onChange={(e)=> setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">End Date</label>
            <Input type="date" value={form.endDate} onChange={(e)=> setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="grid gap-1 md:col-span-2">
            <label className="text-xs text-muted-foreground">Reason</label>
            <Input value={form.reason} onChange={(e)=> setForm({ ...form, reason: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=> setApplyOpen(false)}>Cancel</Button>
          <Button onClick={apply}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  );
}

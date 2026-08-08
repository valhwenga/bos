import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, CheckCircle, XCircle, Clock, AlertCircle, Eye, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HRMLeaveStore, type Leave, type LeaveStatus } from "@/lib/hrmLeaveStore";
import type { ModuleKey } from "@/lib/rolesStore";
import { canAccess, getCurrentRole } from "@/lib/accessControl";
import { AuthStore } from "@/lib/authStore";
import { UserStore } from "@/lib/userStore";
import { countWorkingDays, updateLeaveBalances } from "@/lib/leaveBalance";
import { PUBLIC_HOLIDAYS } from "@/lib/holidays";
import { notifyManagerOfLeaveRequest, notifyEmployeeOfLeaveDecision } from "@/lib/emailNotifier";
import { LeaveBalanceStore } from "@/lib/leaveBalanceStore";
import { LeaveBalanceDisplay } from "@/components/LeaveBalanceDisplay";
import { HolidayCalendar } from "@/components/HolidayCalendar";

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
  const user = UserStore.get();
  const role = getCurrentRole();

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [form, setForm] = useState<{ employee: string; employeeId: string; type: string; startDate: string; endDate: string; reason: string }>(() => ({
    employee: user.name || "",
    employeeId: user.id || "",
    type: "Sick Leave",
    startDate: "",
    endDate: "",
    reason: "",
  }));

  const canReviewAll = canAccess("hrm.leave" as ModuleKey, "full");
  const canEdit = canAccess("hrm.leave" as ModuleKey, "edit");
  const isPrivileged = role.id === "role_super_admin" || role.id === "role_company_admin";
  const managedDepartmentIds = useMemo(() => {
    const set = new Set(user.managedDepartmentIds || []);
    if (user.departmentId) set.add(user.departmentId);
    return set;
  }, [user.departmentId, user.managedDepartmentIds]);

  const visibleLeaves = useMemo(() => {
    const canSee = (l: Leave) => {
      if (isPrivileged) return true;
      if (l.createdByUserId && l.createdByUserId === user.id) return true;
      if (!l.createdByUserId && l.employeeId === user.id) return true;
      if (canReviewAll) {
        if (!l.departmentId) return true; // legacy records without department
        return managedDepartmentIds.has(l.departmentId);
      }
      return false;
    };

    const list = leaves.filter(canSee);
    if (statusFilter === "all") return list;
    const target = statusFilter[0].toUpperCase() + statusFilter.slice(1);
    return list.filter(l => l.status === target);
  }, [canReviewAll, isPrivileged, leaves, managedDepartmentIds, statusFilter, user.id]);

  const stats = useMemo(() => {
    const all = visibleLeaves;
    const pending = all.filter(l => l.status === "Pending").length;
    const approved = all.filter(l => l.status === "Approved").length;
    const rejected = all.filter(l => l.status === "Rejected").length;
    return [
      { type: "Total Requests", count: all.length, icon: "📝", color: "bg-blue-500" },
      { type: "Pending", count: pending, icon: "⏳", color: "bg-orange-500" },
      { type: "Approved", count: approved, icon: "✅", color: "bg-green-500" },
      { type: "Rejected", count: rejected, icon: "❌", color: "bg-red-500" },
    ];
  }, [visibleLeaves]);

  useEffect(() => {
    const refresh = () => setLeaves(HRMLeaveStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key === "hrm.leaves") refresh(); };
    window.addEventListener("hrm.leave-changed", refresh);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("hrm.leave-changed", refresh); window.removeEventListener("storage", onStorage); };
  }, []);

  const canActOnLeave = (l?: Leave) => {
    if (!canReviewAll) return false;
    if (isPrivileged) return true;
    if (!l?.departmentId) return true;
    return managedDepartmentIds.has(l.departmentId);
  };

  const view = (l: Leave) => { setSelected(l); setAction(null); setManagerNote(""); setOpen(true); };
  const approve = (l: Leave) => { if(!canActOnLeave(l)) return; setSelected(l); setAction("Approved"); setManagerNote(""); setOpen(true); };
  const reject = (l: Leave) => { if(!canActOnLeave(l)) return; setSelected(l); setAction("Rejected"); setManagerNote(""); setOpen(true); };
  const submit = () => {
    if (!selected || !action) { setOpen(false); return; }
    if (!canActOnLeave(selected)) { setOpen(false); return; }
    const updated = HRMLeaveStore.setStatus(selected.id, action, managerNote);
    // Auto-deduct or restore balance on approval/rejection
    if (updated && action === "Approved") {
      LeaveBalanceStore.deduct(updated.employeeId, updated.type, updated.days);
    } else if (updated && action === "Rejected") {
      // If it was previously approved, restore days (edge case)
      LeaveBalanceStore.add(updated.employeeId, updated.type, updated.days);
    }
    // Notify employee of decision
    if (updated) {
      notifyEmployeeOfLeaveDecision(updated);
    }
    setOpen(false);
  };
  const apply = () => {
    if (!form.employee.trim() || !form.employeeId.trim() || !form.type.trim() || !form.startDate || !form.endDate) return;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    // Calculate working days (exclude weekends and public holidays)
    const workingDays = countWorkingDays(form.startDate, form.endDate);
    const l: Leave = {
      id: `L${Date.now()}`,
      employee: form.employee,
      employeeId: form.employeeId,
      createdByUserId: user.id,
      departmentId: user.departmentId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      days: workingDays,
      reason: form.reason,
      status: "Pending",
      appliedOn: new Date().toISOString(),
    };
    HRMLeaveStore.upsert(l);
    // Notify manager (placeholder email)
    notifyManagerOfLeaveRequest(l);
    setApplyOpen(false);
    setForm({ employee: user.name || "", employeeId: user.id || "", type: "Sick Leave", startDate: "", endDate: "", reason: "" });
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
        {stats.map((stat, index) => (
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
            <Select value={statusFilter} onValueChange={(v)=> setStatusFilter(v as typeof statusFilter)}>
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
              {visibleLeaves.map((request) => (
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
                    {request.status === "Pending" && canActOnLeave(request) && (
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
          <span>Showing {visibleLeaves.length ? 1 : 0} to {visibleLeaves.length} of {visibleLeaves.length} entries</span>
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
          {canActOnLeave(selected || undefined) && action && (
            <div className="grid gap-2 mt-3">
              <label className="text-xs text-muted-foreground">Manager Note ({action === 'Rejected' ? 'required' : 'optional'})</label>
              <Input value={managerNote} onChange={(e)=> setManagerNote(e.target.value)} placeholder={action === 'Rejected' ? 'Provide a reason for rejection' : 'Optional note'} />
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Close</Button>
            {canActOnLeave(selected || undefined) && action && <Button onClick={submit} disabled={action==='Rejected' && !managerNote.trim()}>Confirm {action}</Button>}
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
            <Input value={form.employee} onChange={(e)=> setForm({ ...form, employee: e.target.value })} readOnly={!isPrivileged && !canReviewAll} />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Employee ID</label>
            <Input value={form.employeeId} onChange={(e)=> setForm({ ...form, employeeId: e.target.value })} readOnly={!isPrivileged && !canReviewAll} />
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

    {/* Leave balance display for current employee */}
    <LeaveBalanceDisplay employeeId={user.id || ""} />

    {/* Holiday calendar */}
    <HolidayCalendar />
  </div>
  );
}

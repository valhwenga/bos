import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, CheckCircle, XCircle, Clock, AlertCircle, Eye, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
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
import { notifyManagerOfLeaveRequest, notifyEmployeeOfLeaveDecision } from "@/lib/emailNotifier";
import { LeaveBalanceStore } from "@/lib/leaveBalanceStore";
import { LeaveBalanceDisplay } from "@/components/LeaveBalanceDisplay";
import { HolidayCalendar } from "@/components/HolidayCalendar";

const statusColors = {
  Pending: "bg-warning text-warning-foreground",
  Approved: "bg-primary text-primary-foreground",
  Rejected: "bg-danger text-danger-foreground",
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
      { type: "Total Requests", count: all.length, icon: "📝", color: "bg-info" },
      { type: "Pending", count: pending, icon: "⏳", color: "bg-warning" },
      { type: "Approved", count: approved, icon: "✅", color: "bg-success" },
      { type: "Rejected", count: rejected, icon: "❌", color: "bg-danger" },
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
  type LeaveRow = (typeof visibleLeaves)[number];

  const columns: Column<LeaveRow>[] = [
    {
      id: "employee",
      header: "Employee",
      sortValue: (r) => r.employee,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-2xs font-medium text-primary-foreground">
              {r.employee.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{r.employee}</span>
            <span className="text-xs text-muted-foreground">{r.employeeId}</span>
          </div>
        </div>
      ),
    },
    { id: "type", header: "Type", sortValue: (r) => r.type, cell: (r) => r.type },
    {
      id: "dates",
      header: "Dates",
      sortValue: (r) => r.startDate,
      cell: (r) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "days",
      header: "Days",
      align: "right",
      sortValue: (r) => r.days,
      cell: (r) => <span className="font-medium">{r.days}</span>,
    },
    {
      id: "reason",
      header: "Reason",
      hideOnMobile: true,
      cell: (r) => <span className="block max-w-xs truncate text-muted-foreground" title={r.reason}>{r.reason || "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (r) => r.status,
      cell: (r) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium ${statusColors[r.status as keyof typeof statusColors] ?? "bg-muted text-muted-foreground"}`}>
          {r.status}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (r) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => view(r)} aria-label="View request">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {r.status === "Pending" && canActOnLeave(r) && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-success" onClick={() => approve(r)} aria-label="Approve request">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => reject(r)} aria-label="Reject request">
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = visibleLeaves.filter((r) => r.status === "Pending").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Leave"
        description="Requests, approvals and how much leave has been taken."
        breadcrumbs={[{ label: "HRM", to: "/hrm/employees" }, { label: "Leave" }]}
        actions={
          <Button onClick={() => setApplyOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Apply for leave
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.type} label={stat.type} value={stat.count} hint="Requests recorded" />
          ))}
        </div>
      </PageHeader>

      <DataTable
        rows={visibleLeaves}
        columns={columns}
        rowKey={(r) => r.id}
        searchAccessor={(r) => `${r.employee} ${r.employeeId} ${r.type} ${r.reason ?? ""}`}
        searchPlaceholder="Search by employee, type or reason…"
        onRowClick={view}
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        }
        empty={{
          title: pendingCount ? "Nothing matches this filter" : "No leave requests",
          description: "Requests appear here once someone applies for leave.",
          action: <Button onClick={() => setApplyOpen(true)}>Apply for leave</Button>,
        }}
      />

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

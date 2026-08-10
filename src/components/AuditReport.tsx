import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter, Search } from "lucide-react";
import { AuditStore, type AuditLog, type AuditAction, type AuditEntity } from "@/lib/auditStore";
import { UserStore } from "@/lib/userStore";

export function AuditReport() {
  const [logs, setLogs] = useState<AuditLog[]>(AuditStore.list());
  const [filtered, setFiltered] = useState<AuditLog[]>(logs);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [entityFilter, setEntityFilter] = useState<AuditEntity | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const refresh = () => setLogs(AuditStore.list());
    window.addEventListener("audit.logs-changed", refresh);
    return () => window.removeEventListener("audit.logs-changed", refresh);
  }, []);

  useEffect(() => {
    let f = logs;
    if (search) {
      f = f.filter(log => log.userName.toLowerCase().includes(search.toLowerCase()) || log.details?.toLowerCase().includes(search.toLowerCase()));
    }
    if (actionFilter !== "all") {
      f = f.filter(log => log.action === actionFilter);
    }
    if (entityFilter !== "all") {
      f = f.filter(log => log.entity === entityFilter);
    }
    if (dateFrom) {
      f = f.filter(log => log.timestamp >= dateFrom);
    }
    if (dateTo) {
      f = f.filter(log => log.timestamp <= dateTo + "T23:59:59");
    }
    setFiltered(f);
  }, [logs, search, actionFilter, entityFilter, dateFrom, dateTo]);

  const exportCSV = () => {
    const csv = AuditStore.exportCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const actionColors: Record<AuditAction, string> = {
    create: "bg-success text-success-foreground",
    update: "bg-info text-info-foreground",
    delete: "bg-danger text-danger-foreground",
    approve: "bg-success text-success-foreground",
    reject: "bg-warning text-warning-foreground",
    login: "bg-primary text-primary-foreground",
    logout: "bg-secondary text-secondary-foreground",
    export: "bg-info text-info-foreground",
    view: "bg-info text-info-foreground",
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">Audit Trail</h4>
        <Button size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <div className="relative">
          <Input
            placeholder="Search user or details"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="export">Export</SelectItem>
            <SelectItem value="view">View</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as AuditEntity | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="payroll">Payroll</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
            <SelectItem value="performance">Performance</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="company_settings">Company Settings</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          placeholder="From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          placeholder="To"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs">{new Date(log.timestamp).toLocaleString()}</TableCell>
                <TableCell>{log.userName}</TableCell>
                <TableCell>
                  <Badge className={actionColors[log.action]}>{log.action}</Badge>
                </TableCell>
                <TableCell>{log.entity}</TableCell>
                <TableCell className="max-w-xs truncate">{log.details ?? "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                  No audit logs match the filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length > 100 && (
        <div className="text-center text-sm text-muted-foreground mt-2">
          Showing first 100 of {filtered.length} results. Refine filters to see more.
        </div>
      )}
    </Card>
  );
}

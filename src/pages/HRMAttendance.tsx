import { Button } from "@/components/ui/button";
import { Download, Calendar, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { UserStore, type AttendanceEntry } from "@/lib/userStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = { employee: string; id: string; department?: string; checkIn: string; checkOut: string; workHours: string; status: string; date: string };

const statusColors = {
  Present: "bg-primary text-white",
  "In Progress": "bg-orange-500 text-white",
  Absent: "bg-red-500 text-white",
};

const HRMAttendance = () => {
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(UserStore.attendance());
  const [view, setView] = useState<"today" | "all">("today");
  const user = UserStore.get();
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth.attendance") setAttendance(UserStore.attendance());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const rowsAll: Row[] = useMemo(() => {
    const fmt = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
    const dur = (a?: string, b?: string) => {
      if (!a || !b) return a && !b ? "In Progress" : "-";
      const ms = Math.max(0, new Date(b).getTime() - new Date(a).getTime());
      const h = Math.floor(ms/3600000); const m = Math.floor((ms%3600000)/60000);
      return `${h}h ${m}m`;
    };
    return attendance.map((e) => {
      const checkIn = fmt(e.clockIn);
      const checkOut = fmt(e.clockOut);
      const workHours = dur(e.clockIn, e.clockOut);
      let status = "Absent";
      if (e.clockIn && e.clockOut) status = "Present";
      else if (e.clockIn && !e.clockOut) status = "In Progress";
      const date = new Date(e.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
      return { employee: user.name, id: user.id, department: user.department, checkIn, checkOut, workHours, status, date };
    });
  }, [attendance, user]);

  const rows: Row[] = useMemo(() => {
    if (view === "all") return rowsAll;
    const today = new Date().toISOString().slice(0,10);
    // filter original attendance by ISO date match to avoid locale issues
    const indices = attendance.map((e, i) => ({ i, e })).filter(x => x.e.date === today).map(x => x.i);
    return rowsAll.filter((_, i) => indices.includes(i));
  }, [rowsAll, attendance, view]);

  const presentCount = rows.filter(r => r.status === 'Present').length;
  const inProgress = rows.filter(r => r.status === 'In Progress').length;
  const absentCount = rows.filter(r => r.status === 'Absent').length;

  const doClockIn = () => { UserStore.clockIn(); setAttendance(UserStore.attendance()); };
  const doClockOut = () => { UserStore.clockOut(); setAttendance(UserStore.attendance()); };

  const handleExport = () => {
    const header = ["Employee","ID","Department","Date","Check In","Check Out","Work Hours","Status"];
    const esc = (v: unknown) => `"${String(v).replace(/"/g,'""')}"`;
    const lines = [header.join(",")].concat(rows.map(r => [r.employee, r.id, r.department||"", r.date, r.checkIn, r.checkOut, r.workHours, r.status]
      .map(esc).join(",")));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance_${view}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const todayIso = new Date().toISOString().slice(0,10);
  const todayEntry = attendance.find(e => e.date === todayIso);
  const todayStatus = (() => {
    if (!todayEntry) return "Absent";
    if (todayEntry.clockIn && todayEntry.clockOut) return "Present";
    if (todayEntry.clockIn && !todayEntry.clockOut) return "In Progress";
    return "Absent";
  })();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Employee Attendance</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-primary">Attendance</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={doClockIn}>
            Clock In
          </Button>
          <Button variant="outline" size="sm" onClick={doClockOut}>
            Clock Out
          </Button>
          <Select value={view} onValueChange={(v)=> setView(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Select Date
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Today's Status</span>
            <div className="w-10 h-10 rounded-lg bg-secondary/40 flex items-center justify-center">
              <span className="text-xl">📅</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{todayStatus}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {todayEntry?.clockIn ? new Date(todayEntry.clockIn).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}
            {" "}–{" "}
            {todayEntry?.clockOut ? new Date(todayEntry.clockOut).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Present Today</span>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-xl">✓</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{presentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Recorded days</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">On Leave</span>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="text-xl">🏖️</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{inProgress}</p>
          <p className="text-xs text-muted-foreground mt-1">Checked-in, not out</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Late Arrivals</span>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <span className="text-xl">⏰</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{rows.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total records</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Absent</span>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <span className="text-xl">✗</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{absentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">No check-in</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
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
            <span className="text-sm text-muted-foreground">entries per page</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="search" placeholder="Search..." className="pl-9 w-64" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">EMPLOYEE</th>
                <th className="text-left p-4 font-semibold text-sm">DEPARTMENT</th>
                <th className="text-left p-4 font-semibold text-sm">DATE</th>
                <th className="text-left p-4 font-semibold text-sm">CHECK IN</th>
                <th className="text-left p-4 font-semibold text-sm">CHECK OUT</th>
                <th className="text-left p-4 font-semibold text-sm">WORK HOURS</th>
                <th className="text-left p-4 font-semibold text-sm">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record, index) => (
                <tr key={index} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                          {record.employee.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{record.employee}</p>
                        <p className="text-xs text-muted-foreground">{record.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{record.department}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{record.date}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium">{record.checkIn}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium">{record.checkOut}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{record.workHours}</span>
                  </td>
                  <td className="p-4">
                    <Badge className={statusColors[record.status as keyof typeof statusColors]}>
                      {record.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing 1 to 6 of 6 entries</span>
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
    </div>
  );
};

export default HRMAttendance;

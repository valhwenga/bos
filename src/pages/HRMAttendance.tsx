import { Button } from "@/components/ui/button";
import { Download, Calendar, Search, CalendarClock, CheckCircle2, Timer, ListChecks } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
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

type ViewMode = "today" | "all" | "date";
type Row = { employee: string; id: string; department?: string; checkIn: string; checkOut: string; workHours: string; status: string; date: string };

const statusColors = {
  Present: "bg-primary text-primary-foreground",
  "In Progress": "bg-warning text-warning-foreground",
  Absent: "bg-danger text-danger-foreground",
};

const HRMAttendance = () => {
  const [attendance, setAttendance] = useState<AttendanceEntry[]>(UserStore.attendance());
  const [view, setView] = useState<ViewMode>("today");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
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
    const targetDate = view === "date" ? selectedDate : new Date().toISOString().slice(0, 10);
    // filter original attendance by ISO date match to avoid locale issues
    const indices = attendance.map((e, i) => ({ i, e })).filter(x => x.e.date === targetDate).map(x => x.i);
    return rowsAll.filter((_, i) => indices.includes(i));
  }, [rowsAll, attendance, view, selectedDate]);

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
    const datePart = view === "date" ? selectedDate : new Date().toISOString().slice(0,10);
    a.href = url; a.download = `attendance_${view}_${datePart}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const todayIso = new Date().toISOString().slice(0,10);
  const statusIso = view === "date" ? selectedDate : todayIso;
  const statusEntry = attendance.find(e => e.date === statusIso);
  const statusLabel = view === "date" ? "Selected Date Status" : "Today's Status";
  const dayStatus = (() => {
    if (!statusEntry) return "Absent";
    if (statusEntry.clockIn && statusEntry.clockOut) return "Present";
    if (statusEntry.clockIn && !statusEntry.clockOut) return "In Progress";
    return "Absent";
  })();

  type AttendanceRow = (typeof rows)[number];

  const columns: Column<AttendanceRow>[] = [
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
            <span className="text-xs text-muted-foreground">{r.id}</span>
          </div>
        </div>
      ),
    },
    { id: "department", header: "Department", hideOnMobile: true, sortValue: (r) => r.department ?? "", cell: (r) => r.department || <span className="text-subtle">—</span> },
    { id: "date", header: "Date", sortValue: (r) => r.date, cell: (r) => r.date },
    { id: "in", header: "Check in", align: "right", cell: (r) => <span className="font-medium">{r.checkIn}</span> },
    { id: "out", header: "Check out", align: "right", cell: (r) => <span className="font-medium">{r.checkOut}</span> },
    { id: "hours", header: "Hours", align: "right", hideOnMobile: true, cell: (r) => r.workHours },
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
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Attendance"
        description="Clock-ins and hours worked across the team."
        breadcrumbs={[{ label: "HRM", to: "/hrm/employees" }, { label: "Attendance" }]}
        actions={
          <>
            <Button variant="outline" onClick={doClockIn}>Clock in</Button>
            <Button variant="outline" onClick={doClockOut}>Clock out</Button>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={statusLabel}
            value={dayStatus}
            hint={`${statusEntry?.clockIn ? new Date(statusEntry.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} – ${statusEntry?.clockOut ? new Date(statusEntry.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}`}
            icon={CalendarClock}
          />
          {/* Labels below now describe what is actually counted. "Late arrivals"
              previously showed the total record count, and "On leave" showed
              people who had clocked in but not out. */}
          <StatCard label="Completed days" value={presentCount} hint="Clocked in and out" icon={CheckCircle2} tone="success" />
          <StatCard label="Still clocked in" value={inProgress} hint="No clock-out recorded" icon={Timer} tone={inProgress ? "warning" : "neutral"} />
          <StatCard label="Records" value={rows.length} hint="In the selected period" icon={ListChecks} />
        </div>
      </PageHeader>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => `${r.id}-${r.date}`}
        searchAccessor={(r) => `${r.employee} ${r.id} ${r.department ?? ""} ${r.date}`}
        searchPlaceholder="Search by employee or date…"
        toolbar={
          <>
            <Select value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="date">Selected date</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setView("date"); }}
              className="h-9 w-36"
              aria-label="Selected date"
            />
          </>
        }
        empty={{
          title: "No attendance recorded",
          description: "Clock-ins for the selected period will show up here.",
        }}
      />
    </div>
  );
};

export default HRMAttendance;

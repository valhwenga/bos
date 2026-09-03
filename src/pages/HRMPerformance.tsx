import { useState, useEffect, useMemo } from "react";
import { useCache } from "@/lib/collectionCache";
import { performanceCache } from "@/lib/hrmPerformanceStore";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Target, Award, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HRMPerformanceStore, type Performance, type PerformanceStatus } from "@/lib/hrmPerformanceStore";
import { computeAttendancePercent } from "@/lib/performanceUtils";
import { PerformanceGoals } from "@/components/PerformanceGoals";
import { PerformanceCalibration } from "@/components/PerformanceCalibration";
import { Review360Form } from "@/components/Review360Form";

const performanceDataSeed = HRMPerformanceStore.list();

/** Derives the summary tiles from actual review records rather than fixed copy. */
function buildPerformanceStats(records: Performance[]) {
  const count = records.length;
  const avg = (pick: (r: Performance) => number) =>
    count ? records.reduce((sum, r) => sum + (pick(r) || 0), 0) / count : 0;

  const goalsCompleted = records.reduce((sum, r) => sum + (r.goalsCompleted || 0), 0);
  const totalGoals = records.reduce((sum, r) => sum + (r.totalGoals || 0), 0);
  const topPerformers = records.filter((r) => r.status === "Excellent").length;

  return [
    {
      title: "Average Rating",
      value: count ? avg((r) => r.rating).toFixed(2) : "—",
      subtitle: count ? `Across ${count} review${count === 1 ? "" : "s"}` : "No reviews yet",
      icon: Award,
      color: "bg-info",
    },
    {
      title: "Goals Completed",
      value: totalGoals ? `${goalsCompleted}/${totalGoals}` : "—",
      subtitle: totalGoals ? `${Math.round((goalsCompleted / totalGoals) * 100)}% completion` : "No goals set",
      icon: Target,
      color: "bg-success",
    },
    {
      title: "Avg Productivity",
      value: count ? `${Math.round(avg((r) => r.productivity))}%` : "—",
      subtitle: count ? "Current review cycle" : "No reviews yet",
      icon: TrendingUp,
      color: "bg-primary",
    },
    {
      title: "Top Performers",
      value: String(topPerformers),
      subtitle: "Excellent rating",
      icon: Award,
      color: "bg-warning",
    },
  ];
}

const statusColors = {
  Excellent: "bg-success text-success-foreground",
  Good: "bg-info text-info-foreground",
  Average: "bg-warning text-warning-foreground",
  "Needs Improvement": "bg-danger text-danger-foreground",
};

const HRMPerformance = () => {
  // Rows come from Postgres via a cache.
  useCache(performanceCache);
  const [data, setData] = useState<Performance[]>(HRMPerformanceStore.list());
  const performanceStats = useMemo(() => buildPerformanceStats(data), [data]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Performance | null>(null);
  const [showCalculation, setShowCalculation] = useState<{ breakdown: string[] } | null>(null);
  const [form, setForm] = useState<Performance>({ id: `PR${Math.floor(Math.random()*900+100)}`, employee: "", employeeId: "", department: "", rating: 0, goalsCompleted: 0, totalGoals: 10, attendance: 0, productivity: 0, status: "Good", reviewDate: new Date().toISOString().slice(0,10) });

  // Auto-calculate attendance when employeeId or reviewDate changes
  useEffect(() => {
    if (form.employeeId && form.reviewDate) {
      const calc = computeAttendancePercent(form.employeeId, form.reviewDate);
      setForm(prev => ({ ...prev, attendance: calc.attendancePercent }));
    }
  }, [form.employeeId, form.reviewDate]);

  const employeeOptions = Array.from(
    new Map(
      data
        .filter((r) => r.employee && r.employeeId)
        .map((r) => [r.employee, { employee: r.employee, employeeId: r.employeeId, department: r.department }])
    ).values()
  ).sort((a, b) => a.employee.localeCompare(b.employee));

  const handleEmployeeSelect = (employeeName: string) => {
    const found = employeeOptions.find((e) => e.employee === employeeName);
    setForm({
      ...form,
      employee: employeeName,
      employeeId: found?.employeeId ?? "",
      department: found?.department ?? "",
    });
  };

  const handleShowCalculation = () => {
    if (!form.employeeId || !form.reviewDate) {
      setShowCalculation({ breakdown: ["Select an employee and review date to see calculation."] });
      return;
    }
    const calc = computeAttendancePercent(form.employeeId, form.reviewDate);
    setShowCalculation({ breakdown: calc.breakdown });
  };
  const add = () => {
    if (!form.employee.trim() || !form.employeeId.trim()) return;
    void HRMPerformanceStore.upsert(form);
    setData(HRMPerformanceStore.list());
    setOpen(false);
    setForm({ id: `PR${Math.floor(Math.random()*900+100)}`, employee: "", employeeId: "", department: "", rating: 0, goalsCompleted: 0, totalGoals: 10, attendance: 0, productivity: 0, status: "Good", reviewDate: new Date().toISOString().slice(0,10) });
  };
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Performance Management</h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-foreground">Performance</span>
          </div>
        </div>

        <Button size="sm" onClick={()=> setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Review
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {performanceStats.map((stat, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-3xl font-bold mb-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {data.map((record) => (
          <Card key={record.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary text-primary-foreground font-medium text-lg">
                    {record.employee.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{record.employee}</h3>
                  <p className="text-sm text-muted-foreground">{record.department} • {record.employeeId}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={statusColors[record.status as keyof typeof statusColors]}>
                  {record.status}
                </Badge>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{record.rating}</span>
                    <span className="text-sm text-muted-foreground">/5.0</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Overall Rating</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Goals Progress</span>
                  <span className="text-sm font-medium">{record.goalsCompleted}/{record.totalGoals}</span>
                </div>
                <Progress value={(record.goalsCompleted / record.totalGoals) * 100} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Attendance</span>
                  <span className="text-sm font-medium">{record.attendance}%</span>
                </div>
                <Progress value={record.attendance} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Productivity</span>
                  <span className="text-sm font-medium">{record.productivity}%</span>
                </div>
                <Progress value={record.productivity} className="h-2" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">Last Review: {new Date(record.reviewDate).toLocaleDateString()}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=> setDetail(record)}>View Details</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Performance Review</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Employee</label>
              <Select value={form.employee} onValueChange={handleEmployeeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((emp) => (
                    <SelectItem key={emp.employeeId} value={emp.employee}>
                      {emp.employee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Employee ID</label>
              <Input value={form.employeeId} readOnly />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Department</label>
              <Input value={form.department} onChange={(e)=> setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Rating (0-5)</label>
              <Input type="number" min={0} max={5} step={0.1} value={form.rating} onChange={(e)=> setForm({ ...form, rating: parseFloat(e.target.value||"0") })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Goals Completed</label>
              <Input type="number" value={form.goalsCompleted} onChange={(e)=> setForm({ ...form, goalsCompleted: parseInt(e.target.value||"0") })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Total Goals</label>
              <Input type="number" value={form.totalGoals} onChange={(e)=> setForm({ ...form, totalGoals: parseInt(e.target.value||"0") })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Attendance %</label>
              <div className="flex gap-1">
                <Input type="number" value={form.attendance} onChange={(e)=> setForm({ ...form, attendance: parseInt(e.target.value||"0") })} />
                <Button type="button" variant="outline" size="sm" onClick={handleShowCalculation} title="Show calculation breakdown">
                  <Calculator className="w-4 h-4" />
                </Button>
              </div>
              {showCalculation && (
                <div className="text-xs text-muted-foreground bg-secondary/30 rounded p-2 mt-1">
                  {showCalculation.breakdown.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Productivity %</label>
              <Input type="number" value={form.productivity} onChange={(e)=> setForm({ ...form, productivity: parseInt(e.target.value||"0") })} />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Status</label>
              <select className="h-10 rounded-md border bg-background px-3" value={form.status} onChange={(e)=> setForm({ ...form, status: e.target.value as PerformanceStatus })}>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Average">Average</option>
                <option value="Needs Improvement">Needs Improvement</option>
              </select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Review Date</label>
              <Input type="date" value={form.reviewDate} onChange={(e)=> setForm({ ...form, reviewDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v)=> setDetail(v ? detail : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Performance Details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid gap-1 text-sm">
              <div><span className="text-muted-foreground">Employee:</span> {detail.employee} ({detail.employeeId})</div>
              <div><span className="text-muted-foreground">Department:</span> {detail.department}</div>
              <div><span className="text-muted-foreground">Rating:</span> {detail.rating}/5</div>
              <div><span className="text-muted-foreground">Goals:</span> {detail.goalsCompleted}/{detail.totalGoals}</div>
              <div><span className="text-muted-foreground">Attendance:</span> {detail.attendance}%</div>
              <div><span className="text-muted-foreground">Productivity:</span> {detail.productivity}%</div>
              <div><span className="text-muted-foreground">Status:</span> {detail.status}</div>
              <div><span className="text-muted-foreground">Review Date:</span> {new Date(detail.reviewDate).toLocaleDateString()}</div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={()=> setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Performance Features */}
      {detail && (
        <>
          <PerformanceGoals employeeId={detail.employeeId} />
          <PerformanceCalibration />
          <Review360Form employeeId={detail.employeeId} employeeName={detail.employee} />
        </>
      )}
    </div>
  );
};

export default HRMPerformance;

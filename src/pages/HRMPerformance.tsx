import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Target, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HRMPerformanceStore, type Performance, type PerformanceStatus } from "@/lib/hrmPerformanceStore";

const performanceDataSeed = HRMPerformanceStore.list();

const performanceStats = [
  {
    title: "Average Rating",
    value: "4.25",
    subtitle: "Out of 5.0",
    icon: Award,
    color: "bg-blue-500",
  },
  {
    title: "Goals Completed",
    value: "45/60",
    subtitle: "75% completion",
    icon: Target,
    color: "bg-green-500",
  },
  {
    title: "Avg Productivity",
    value: "85%",
    subtitle: "+3% from last month",
    icon: TrendingUp,
    color: "bg-purple-500",
  },
  {
    title: "Top Performers",
    value: "3",
    subtitle: "Excellent rating",
    icon: Award,
    color: "bg-orange-500",
  },
];

const statusColors = {
  Excellent: "bg-green-500 text-white",
  Good: "bg-blue-500 text-white",
  Average: "bg-orange-500 text-white",
  "Needs Improvement": "bg-red-500 text-white",
};

const HRMPerformance = () => {
  const [data, setData] = useState<Performance[]>(HRMPerformanceStore.list());
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Performance | null>(null);
  const [form, setForm] = useState<Performance>({ id: `PR${Math.floor(Math.random()*900+100)}`, employee: "", employeeId: "", department: "", rating: 0, goalsCompleted: 0, totalGoals: 10, attendance: 0, productivity: 0, status: "Good", reviewDate: new Date().toISOString().slice(0,10) });
  const add = () => {
    if (!form.employee.trim() || !form.employeeId.trim()) return;
    HRMPerformanceStore.upsert(form);
    setData(HRMPerformanceStore.list());
    setOpen(false);
    setForm({ id: `PR${Math.floor(Math.random()*900+100)}`, employee: "", employeeId: "", department: "", rating: 0, goalsCompleted: 0, totalGoals: 10, attendance: 0, productivity: 0, status: "Good", reviewDate: new Date().toISOString().slice(0,10) });
  };
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Performance Management</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-primary">Performance</span>
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
                <stat.icon className="w-6 h-6 text-white" />
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
              <Input value={form.employee} onChange={(e)=> setForm({ ...form, employee: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Employee ID</label>
              <Input value={form.employeeId} onChange={(e)=> setForm({ ...form, employeeId: e.target.value })} />
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
              <Input type="number" value={form.attendance} onChange={(e)=> setForm({ ...form, attendance: parseInt(e.target.value||"0") })} />
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
    </div>
  );
};

export default HRMPerformance;

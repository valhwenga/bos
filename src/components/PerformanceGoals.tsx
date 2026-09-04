import { useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, CheckCircle, Clock, XCircle } from "lucide-react";
import { PerformanceAdvancedStore, goalsCache, type Goal } from "@/lib/performanceAdvanced";
import { UserStore } from "@/lib/userStore";

type Props = {
  employeeId: string;
};

export function PerformanceGoals({ employeeId }: Props) {
  // From the cache rather than copied into state. The events these listened
  // for were dispatched by the localStorage writer that no longer exists, and
  // a server read is not there on the first render anyway.
  useCache(goalsCache);
  const goals = PerformanceAdvancedStore.goalsForEmployee(employeeId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const user = UserStore.get();

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "smart" as Goal["category"],
    dueDate: "",
    progress: 0,
    status: "not_started" as Goal["status"],
  });

  const save = () => {
    if (!form.title.trim() || !form.dueDate) return;
    const goal: Goal = {
      id: editing ? editing.id : `G${Date.now()}`,
      employeeId,
      title: form.title,
      description: form.description,
      category: form.category,
      dueDate: form.dueDate,
      progress: form.progress,
      status: form.status,
      reviewerId: user.id,
    };
    void PerformanceAdvancedStore.upsertGoal(goal);
    setOpen(false);
    setEditing(null);
    setForm({ title: "", description: "", category: "smart", dueDate: "", progress: 0, status: "not_started" });
  };

  const startEdit = (g: Goal) => {
    setEditing(g);
    setForm({
      title: g.title,
      description: g.description,
      category: g.category,
      dueDate: g.dueDate,
      progress: g.progress,
      status: g.status,
    });
    setOpen(true);
  };

  const remove = (id: string) => {
    void PerformanceAdvancedStore.removeGoal(id);
  };

  const statusIcons = {
    not_started: <Clock className="w-4 h-4 text-muted-foreground" />,
    in_progress: <Target className="w-4 h-4 text-info" />,
    completed: <CheckCircle className="w-4 h-4 text-success" />,
    blocked: <XCircle className="w-4 h-4 text-danger" />,
  };

  const categoryColors = {
    objective: "bg-primary text-primary-foreground",
    key_result: "bg-info text-info-foreground",
    smart: "bg-success text-success-foreground",
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">Goals & OKRs</h4>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ title: "", description: "", category: "smart", dueDate: "", progress: 0, status: "not_started" }); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Goal
        </Button>
      </div>
      <div className="space-y-3">
        {goals.map((g) => (
          <div key={g.id} className="border rounded p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {statusIcons[g.status]}
                <Badge className={categoryColors[g.category]}>{g.category}</Badge>
                <span className="font-medium">{g.title}</span>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" onClick={() => startEdit(g)}>✏️</Button>
                <Button size="icon" variant="outline" onClick={() => remove(g.id)}>🗑️</Button>
              </div>
            </div>
            {g.description && <p className="text-sm text-muted-foreground mb-2">{g.description}</p>}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Due: {new Date(g.dueDate).toLocaleDateString()}</span>
              <span>{g.progress}%</span>
            </div>
            <Progress value={g.progress} className="mt-1 h-2" />
          </div>
        ))}
        {goals.length === 0 && (
          <div className="text-center text-muted-foreground py-4">No goals set.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Goal" : "Add Goal"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Goal["category"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objective">Objective</SelectItem>
                    <SelectItem value="key_result">Key Result</SelectItem>
                    <SelectItem value="smart">SMART Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Goal["status"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Progress (%)</label>
              <Input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

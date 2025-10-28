import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, Task, TaskStatus, TaskUpdate } from "@/lib/projectStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Column: React.FC<{ title: string; status: TaskStatus; tasks: Task[]; onMove: (id: string, s: TaskStatus) => void; onComment: (t: Task) => void }>= ({ title, status, tasks, onMove, onComment }) => (
  <div className="flex-1 min-w-[240px] bg-card rounded-lg border p-3 shadow-[0_6px_0_rgba(0,0,0,0.05)]">
    <h4 className="font-semibold mb-2">{title}</h4>
    <div className="space-y-2">
      {tasks.filter(t => t.status===status).map(t => (
        <div key={t.id} className="bg-background border rounded-lg p-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t.title}</div>
              {t.description && <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
              {t.assignedTo && <div className="text-xs mt-1"><span className="text-muted-foreground">Assigned:</span> {t.assignedTo}</div>}
            </div>
            <div className="space-x-1">
              {status!=="todo" && <Button size="sm" variant="ghost" onClick={()=> onMove(t.id, status==="inprogress"?"todo":"inprogress")}>◀</Button>}
              {status!=="done" && <Button size="sm" variant="ghost" onClick={()=> onMove(t.id, status==="todo"?"inprogress":"done")}>▶</Button>}
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="outline" onClick={()=> onComment(t)}>Add Update</Button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(ProjectStore.listTasks());
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("p_default");
  const [assignedTo, setAssignedTo] = useState("");
  const [desc, setDesc] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const refresh = () => setTasks(ProjectStore.listTasks());
  const add = () => {
    if (!title.trim()) return;
    ProjectStore.upsertTask({ id: `t_${Date.now()}`, projectId, title, status: "todo", assignedTo, description: desc, updates: [] });
    setTitle(""); setAssignedTo(""); setDesc(""); setProjectId("p_default"); setOpen(false);
    refresh();
  };
  const move = (id: string, status: TaskStatus) => {
    const t = ProjectStore.listTasks().find(x=>x.id===id);
    if (!t) return;
    ProjectStore.upsertTask({ ...t, status });
    refresh();
  };
  const onComment = (t: Task) => { setActiveTask(t); setCommentOpen(true); };
  const saveComment = () => {
    if (!activeTask || !comment.trim()) { setCommentOpen(false); return; }
    const u: TaskUpdate = { id: `u_${Date.now()}`, message: comment, createdAt: new Date().toISOString() };
    ProjectStore.addTaskUpdate(activeTask.id, u);
    setComment(""); setCommentOpen(false); refresh();
  };
  const grouped = useMemo(()=>({
    todo: tasks.filter(t=>t.status==="todo"),
    inprogress: tasks.filter(t=>t.status==="inprogress"),
    done: tasks.filter(t=>t.status==="done"),
  }), [tasks]);

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            <Button variant="elevated" onClick={()=> setOpen(true)}>Add Task</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Column title="To do" status="todo" tasks={tasks as any} onMove={move} onComment={onComment} />
            <Column title="In progress" status="inprogress" tasks={tasks as any} onMove={move} onComment={onComment} />
            <Column title="Done" status="done" tasks={tasks as any} onMove={move} onComment={onComment} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={title} onChange={(e)=> setTitle(e.target.value)} />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Project</label>
                <select className="h-10 rounded-md border bg-background px-3" value={projectId} onChange={(e)=> setProjectId(e.target.value)}>
                  {ProjectStore.listProjects().map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid gap-1 md:col-span-2">
                <label className="text-xs text-muted-foreground">Assigned To</label>
                <Input value={assignedTo} onChange={(e)=> setAssignedTo(e.target.value)} placeholder="Person responsible" />
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea className="min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm" value={desc} onChange={(e)=> setDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Update{activeTask ? `: ${activeTask.title}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Update</label>
            <textarea className="min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm" value={comment} onChange={(e)=> setComment(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setCommentOpen(false)}>Cancel</Button>
            <Button onClick={saveComment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;

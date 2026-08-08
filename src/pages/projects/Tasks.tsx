import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStore, Task, TaskStatus, TaskUpdate } from "@/lib/projectStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuthStore } from "@/lib/authStore";

const Column: React.FC<{ title: string; status: TaskStatus; tasks: Task[]; onMove: (id: string, s: TaskStatus) => void; onComment: (t: Task) => void; onAssignMe: (t: Task) => void }>= ({ title, status, tasks, onMove, onComment, onAssignMe }) => (
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
              {t.dueAt && <div className="text-xs mt-1"><span className="text-muted-foreground">Due:</span> {new Date(t.dueAt).toLocaleString()}</div>}
            </div>
            <div className="space-x-1">
              {status!=="todo" && <Button size="sm" variant="ghost" onClick={()=> onMove(t.id, status==="inprogress"?"todo":"inprogress")}>◀</Button>}
              {status!=="done" && <Button size="sm" variant="ghost" onClick={()=> onMove(t.id, status==="todo"?"inprogress":"done")}>▶</Button>}
            </div>
          </div>
          <div className="flex justify-end mt-2 gap-2">
            <Button size="sm" variant="secondary" onClick={()=> onAssignMe(t)}>Assign to me</Button>
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
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [dueAt, setDueAt] = useState<string>("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [comment, setComment] = useState("");
  const refresh = () => setTasks(ProjectStore.listTasks());

  const me = AuthStore.currentUser()?.id;
  const accounts = AuthStore.listAccounts();

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener('proj.tasks-changed', onChange as EventListener);
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('proj.tasks')) onChange(); };
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('proj.tasks-changed', onChange as EventListener); window.removeEventListener('storage', onStorage); };
  }, []);

  const applyPreset = (hours: number) => {
    const iso = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 16);
    setDueAt(iso);
  };

  const add = () => {
    if (!title.trim()) return;
    ProjectStore.upsertTask({
      id: `t_${Date.now()}`,
      projectId,
      title,
      status: "todo",
      assignedTo,
      assignedToUserId: assignedToUserId || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      description: desc,
      updates: [],
    });
    setTitle(""); setAssignedTo(""); setAssignedToUserId(""); setDueAt(""); setDesc(""); setProjectId("p_default"); setOpen(false);
    refresh();
  };
  const move = (id: string, status: TaskStatus) => {
    const t = ProjectStore.listTasks().find(x=>x.id===id);
    if (!t) return;
    ProjectStore.upsertTask({ ...t, status });
    refresh();
  };

  const assignMe = (t: Task) => {
    if (!me) return;
    const a = accounts.find(x => x.id === me);
    const next: Task = {
      ...t,
      assignedToUserId: me,
      assignedTo: a?.name || t.assignedTo || "Me",
      dueAt: t.dueAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    ProjectStore.upsertTask(next);
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
            <Button onClick={()=> setOpen(true)}>Add Task</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Column title="To do" status="todo" tasks={tasks as Task[]} onMove={move} onComment={onComment} onAssignMe={assignMe} />
            <Column title="In progress" status="inprogress" tasks={tasks as Task[]} onMove={move} onComment={onComment} onAssignMe={assignMe} />
            <Column title="Done" status="done" tasks={tasks as Task[]} onMove={move} onComment={onComment} onAssignMe={assignMe} />
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
                <div className="grid gap-2">
                  <div className="grid md:grid-cols-3 gap-2">
                    <select className="h-10 rounded-md border bg-background px-3 md:col-span-2" value={assignedToUserId} onChange={(e)=> { setAssignedToUserId(e.target.value); const a = accounts.find(x=> x.id===e.target.value); setAssignedTo(a?.name || ""); }}>
                      <option value="">Unassigned</option>
                      {accounts.map(a=> <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                    </select>
                    <Button variant="secondary" type="button" disabled={!me} onClick={()=> { if(!me) return; setAssignedToUserId(me); const a = accounts.find(x=> x.id===me); setAssignedTo(a?.name || "Me"); }}>Assign to me</Button>
                  </div>
                  <Input value={assignedTo} onChange={(e)=> setAssignedTo(e.target.value)} placeholder="Display name (optional)" />
                </div>
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Expiry / Due</label>
              <div className="grid gap-2">
                <Input type="datetime-local" value={dueAt} onChange={(e)=> setDueAt(e.target.value)} />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={()=> applyPreset(1)}>+1h</Button>
                  <Button type="button" variant="secondary" onClick={()=> applyPreset(24)}>+1d</Button>
                  <Button type="button" variant="secondary" onClick={()=> applyPreset(24*7)}>+1w</Button>
                </div>
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

import { useEffect, useMemo, useState } from "react";
import { CrmTasksStore, type CrmTask, type TaskPriority } from "@/lib/crmTasksStore";
import { CrmLeadsStore } from "@/lib/crmLeadsStore";
import { CrmDealsStore } from "@/lib/crmDealsStore";
import { UsersStore } from "@/lib/usersStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationsStore, notify } from "@/lib/notificationsStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Tasks = () => {
  const [list, setList] = useState(CrmTasksStore.list());
  const users = UsersStore.list();
  const [q, setQ] = useState("");
  const [show, setShow] = useState<'all'|'open'|'completed'>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CrmTask | undefined>(undefined);

  // New task form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<'lead'|'deal'>("lead");
  const [entityId, setEntityId] = useState<string>(CrmLeadsStore.list()[0]?.id || "");
  const [dueAt, setDueAt] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string>(users[0]?.id || "");

  const filtered = useMemo(() => list.filter(t => {
    const hay = `${t.title}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
    if (show==='open' && t.completed) return false;
    if (show==='completed' && !t.completed) return false;
    return true;
  }), [list, q, show]);

  useEffect(() => {
    const refresh = () => setList(CrmTasksStore.list());
    const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('crm.tasks')) refresh(); };
    window.addEventListener('crm.tasks-changed', refresh as any);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('crm.tasks-changed', refresh as any); window.removeEventListener('storage', onStorage); };
  }, []);

  const add = () => { setEditing(undefined); setOpen(true); };

  const startEdit = (t: CrmTask) => {
    setEditing(t);
    setTitle(t.title || "");
    setDescription(t.description || "");
    setEntityType(t.entityType);
    setEntityId(t.entityId);
    setDueAt(t.dueAt ? new Date(t.dueAt).toISOString().slice(0,16) : "");
    setPriority(t.priority);
    setAssigneeId(t.assigneeId || (users[0]?.id || ""));
    setOpen(true);
  };

  const save = () => {
    if (!title.trim()) return;
    const newTask: CrmTask = {
      id: editing?.id || `T_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      entityType,
      entityId,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      priority,
      assigneeId: assigneeId || undefined,
      createdAt: editing?.createdAt || new Date().toISOString(),
      completed: editing?.completed,
    };
    const prevAssignee = editing?.assigneeId;
    CrmTasksStore.upsert(newTask);
    setList(CrmTasksStore.list());
    setOpen(false);
    if (!editing) {
      if (newTask.assigneeId) notify(newTask.assigneeId, 'message', `New CRM Task: ${newTask.title}`, newTask.dueAt ? `Due: ${new Date(newTask.dueAt).toLocaleString()}` : undefined);
    } else if (newTask.assigneeId && newTask.assigneeId !== prevAssignee) {
      notify(newTask.assigneeId, 'message', `Task Assigned: ${newTask.title}`, newTask.dueAt ? `Due: ${new Date(newTask.dueAt).toLocaleString()}` : undefined);
    }
    // reset form
    setTitle(""); setDescription(""); setDueAt(""); setPriority("medium"); setEntityType("lead"); setEntityId(CrmLeadsStore.list()[0]?.id || ""); setAssigneeId(users[0]?.id || "");
    setEditing(undefined);
  };

  const toggle = (t: CrmTask) => { CrmTasksStore.upsert({ ...t, completed: !t.completed }); setList(CrmTasksStore.list()); };

  const remind = (t: CrmTask) => { if (!t.assigneeId) return; notify(t.assigneeId, 'ticket', `Task due: ${t.title}`, `Due: ${t.dueAt ? new Date(t.dueAt).toLocaleString() : 'N/A'}`); };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Tasks</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Search" value={q} onChange={(e)=> setQ(e.target.value)} />
            <Select value={show} onValueChange={(v)=> setShow(v as any)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filter"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={add}>New Task</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/20">
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Entity</th>
                  <th className="text-left p-2">Assignee</th>
                  <th className="text-left p-2">Due</th>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{t.title}</td>
                    <td className="p-2 max-w-[280px] truncate" title={t.description}>{t.description}</td>
                    <td className="p-2 capitalize">{t.entityType} • {t.entityId}</td>
                    <td className="p-2">{users.find(u=>u.id===t.assigneeId)?.name||'-'}</td>
                    <td className="p-2">{t.dueAt ? new Date(t.dueAt).toLocaleString() : '-'}</td>
                    <td className="p-2 capitalize">{t.priority}</td>
                    <td className="p-2 text-right space-x-2">
                      <Button size="sm" variant="secondary" onClick={()=> toggle(t)}>{t.completed ? 'Reopen' : 'Complete'}</Button>
                      <Button size="sm" variant="outline" onClick={()=> startEdit(t)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={()=> { CrmTasksStore.remove(t.id); setList(CrmTasksStore.list()); }}>Delete</Button>
                      <Button size="sm" variant="outline" onClick={()=> remind(t)}>Remind</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={title} onChange={(e)=> setTitle(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={description} onChange={(e)=> setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Entity Type</label>
                <Select value={entityType} onValueChange={(v)=> { setEntityType(v as any); const first = (v==='lead' ? CrmLeadsStore.list()[0]?.id : CrmDealsStore.list()[0]?.id) || ""; setEntityId(first); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="deal">Deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">{entityType==='lead' ? 'Lead' : 'Deal'}</label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger><SelectValue placeholder={`Select ${entityType}`} /></SelectTrigger>
                  <SelectContent>
                    {entityType==='lead' ? (
                      CrmLeadsStore.list().map(l=> <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)
                    ) : (
                      CrmDealsStore.list().map(d=> <SelectItem key={d.id} value={d.id}>{d.title || d.id}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Due Date</label>
                <Input type="datetime-local" value={dueAt} onChange={(e)=> setDueAt(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={(v)=> setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Assign To</label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map(u=> <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!title.trim()}>Save Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;

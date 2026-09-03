import { useEffect, useMemo, useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { leadsCache } from "@/lib/crmLeadsStore";
import { dealsCache } from "@/lib/crmDealsStore";
import { crmCustomersCache } from "@/lib/crmCustomersStore";
import { crmTasksCache } from "@/lib/crmTasksStore";
import { Check, RotateCcw, Bell, Pencil, Trash2, ListChecks, Circle, AlertCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CrmTasksStore, type CrmTask, type TaskPriority } from "@/lib/crmTasksStore";
import { CrmLeadsStore } from "@/lib/crmLeadsStore";
import { CrmDealsStore } from "@/lib/crmDealsStore";
import { UsersStore } from "@/lib/usersStore";
import { AuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationsStore, notify } from "@/lib/notificationsStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Tasks = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(leadsCache);
  useCache(dealsCache);
  useCache(crmCustomersCache);
  useCache(crmTasksCache);
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

  const me = AuthStore.currentUser()?.id;

  const applyPreset = (hours: number) => {
    const iso = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString().slice(0, 16);
    setDueAt(iso);
  };

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
    window.addEventListener('crm.tasks-changed', refresh);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('crm.tasks-changed', refresh); window.removeEventListener('storage', onStorage); };
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
    void CrmTasksStore.upsert(newTask);
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

  const toggle = (t: CrmTask) => { void CrmTasksStore.upsert({ ...t, completed: !t.completed }); setList(CrmTasksStore.list()); };

  const remind = (t: CrmTask) => { if (!t.assigneeId) return; notify(t.assigneeId, 'ticket', `Task due: ${t.title}`, `Due: ${t.dueAt ? new Date(t.dueAt).toLocaleString() : 'N/A'}`); };

  const priorityTone = (priority: string) =>
    priority === "high" ? "bg-danger-soft text-danger"
    : priority === "medium" ? "bg-warning-soft text-warning"
    : "bg-muted text-muted-foreground";

  const isOverdue = (t: CrmTask) => !t.completed && !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();

  const columns: Column<CrmTask>[] = [
    {
      id: "title",
      header: "Task",
      sortValue: (t) => t.title,
      cell: (t) => (
        <div className="flex flex-col">
          <span className={t.completed ? "text-muted-foreground line-through" : "font-medium"}>{t.title}</span>
          {t.description && (
            <span className="max-w-xs truncate text-xs text-muted-foreground" title={t.description}>{t.description}</span>
          )}
        </div>
      ),
    },
    {
      id: "entity",
      header: "Linked to",
      hideOnMobile: true,
      cell: (t) => <span className="capitalize text-muted-foreground">{t.entityType} · {t.entityId}</span>,
    },
    {
      id: "assignee",
      header: "Assignee",
      hideOnMobile: true,
      sortValue: (t) => users.find((u) => u.id === t.assigneeId)?.name ?? "",
      cell: (t) => users.find((u) => u.id === t.assigneeId)?.name || <span className="text-subtle">Unassigned</span>,
    },
    {
      id: "due",
      header: "Due",
      sortValue: (t) => t.dueAt ?? "",
      cell: (t) =>
        t.dueAt ? (
          <span className={isOverdue(t) ? "font-medium text-danger" : "text-muted-foreground"}>
            {new Date(t.dueAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      id: "priority",
      header: "Priority",
      sortValue: (t) => t.priority,
      cell: (t) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${priorityTone(t.priority)}`}>
          {t.priority}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (t) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggle(t)} aria-label={t.completed ? "Reopen task" : "Mark complete"}>
            {t.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remind(t)} aria-label="Send reminder">
            <Bell className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(t)} aria-label="Edit task">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            aria-label="Delete task"
            onClick={() => {
              if (!window.confirm(`Delete task "${t.title}"? This cannot be undone.`)) return;
              void CrmTasksStore.remove(t.id);
              setList(CrmTasksStore.list());
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const overdueCount = filtered.filter(isOverdue).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tasks"
        description="Follow-ups attached to leads, deals and customers."
        breadcrumbs={[{ label: "CRM", to: "/crm/leads" }, { label: "Tasks" }]}
        actions={<Button onClick={add}>New task</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Tasks" value={filtered.length} hint="Matching current filters" icon={ListChecks} />
          <StatCard label="Open" value={filtered.filter((t) => !t.completed).length} hint="Still to do" icon={Circle} />
          <StatCard
            label="Overdue"
            value={overdueCount}
            hint={overdueCount ? "Past their due date" : "Nothing overdue"}
            icon={AlertCircle}
            tone={overdueCount ? "danger" : "neutral"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(t) => t.id}
        searchAccessor={(t) => `${t.title} ${t.description ?? ""} ${t.entityType} ${t.entityId}`}
        searchPlaceholder="Search tasks…"
        onRowClick={startEdit}
        toolbar={
          <Select value={show} onValueChange={(v) => setShow(v as 'all' | 'open' | 'completed')}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        }
        empty={{
          title: "No tasks",
          description: "Add a follow-up so nothing slips between calls.",
          action: <Button onClick={add}>New task</Button>,
        }}
      />

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
                <Select value={entityType} onValueChange={(v) => { setEntityType(v as 'lead'|'deal'); const first = (v==='lead' ? CrmLeadsStore.list()[0]?.id : CrmDealsStore.list()[0]?.id) || ""; setEntityId(first); }}>
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
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
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
              <div className="grid gap-2">
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u=> <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" disabled={!me} onClick={()=> { if(!me) return; setAssigneeId(me); }}>Assign to me</Button>
                </div>
              </div>
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

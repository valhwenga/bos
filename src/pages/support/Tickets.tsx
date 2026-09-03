import { useCallback, useEffect, useMemo, useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { ticketsCache } from "@/lib/supportStore";
import { clientsCache } from "@/lib/clientsStore";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LifeBuoy, Clock, AlertCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SupportStore, type Ticket, type Priority, type TicketStatus } from "@/lib/supportStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { UserStore } from "@/lib/userStore";
import { UsersStore } from "@/lib/usersStore";
import { AuthStore } from "@/lib/authStore";

const statusOptions: TicketStatus[] = ["open","in_progress","waiting","resolved","pending_approval","closed","rejected"];
const priorityOptions: Priority[] = ["low","medium","high","urgent"];

const Tickets = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(ticketsCache);
  useCache(clientsCache);
  const acc = AuthStore.currentUser();
  const myClientId = acc?.clientId;
  const [list, setList] = useState<Ticket[]>(SupportStore.list().filter(t => (myClientId ? t.clientId === myClientId : true)));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState<string | "all" | "unassigned" | "me">("all");
  const [form, setForm] = useState<Ticket>({ id: "", title: "", description: "", requester: "user", priority: "medium", status: "open", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [], attachments: [], category: "General", closureRequest: null, approval: null });

  const refresh = useCallback(() => {
    setList(SupportStore.list().filter(t => (myClientId ? t.clientId === myClientId : true)));
  }, [myClientId]);
  useEffect(()=>{ refresh(); }, [refresh]);

  const me = UserStore.get();
  const filtered = useMemo(() => list.filter(t => {
    const okS = status === "all" || t.status === status;
    const okP = priority === "all" || t.priority === priority;
    const okA = assignee === "all" || (assignee === "unassigned" ? !t.assigneeId : (assignee === "me" ? t.assigneeId === me.id : t.assigneeId === assignee));
    const hay = `${t.id} ${t.title} ${t.description} ${t.category} ${t.priority} ${t.status}`.toLowerCase();
    const okQ = hay.includes(q.toLowerCase());
    return okS && okP && okA && okQ;
  }), [list, q, status, priority, assignee, me.id]);

  const startAdd = () => { 
    const s = SupportStore.settings();
    const now = new Date();
    const addHours = (h: number) => new Date(now.getTime() + h*3600000).toISOString();
    const due = addHours(s.slaTargets["medium"]);
    setForm({ id: `T${Math.floor(Math.random()*90000+10000)}`, title: "", description: "", clientId: myClientId, requester: me.id, priority: "medium", status: "open", createdAt: now.toISOString(), updatedAt: now.toISOString(), dueAt: due, comments: [], attachments: [], category: s.categories[0] || "General", closureRequest: null, approval: null }); setOpen(true); };
  const save = () => {
    if (!form.title.trim()) return;
    const s = SupportStore.settings();
    const now = new Date();
    const slaHrs = s.slaTargets[form.priority];
    const due = new Date(now.getTime() + slaHrs*3600000).toISOString();
    const data = { ...form, clientId: myClientId, requester: me.id, createdAt: now.toISOString(), updatedAt: now.toISOString(), dueAt: due };
    void SupportStore.upsert(data);
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "user", entity: "ticket", entityId: data.id, action: "create", details: data.title });
    setOpen(false);
    refresh();
  };

  const navigate = useNavigate();

  const priorityTone = (p: string) =>
    p === "urgent" ? "bg-danger-soft text-danger"
    : p === "high" ? "bg-warning-soft text-warning"
    : p === "medium" ? "bg-info-soft text-info"
    : "bg-muted text-muted-foreground";

  const statusTone = (st: string) =>
    st === "resolved" ? "bg-success-soft text-success"
    : st === "rejected" ? "bg-danger-soft text-danger"
    : st === "in_progress" || st === "pending_approval" ? "bg-info-soft text-info"
    : st === "waiting" ? "bg-warning-soft text-warning"
    : "bg-muted text-muted-foreground";

  const columns: Column<Ticket>[] = [
    { id: "id", header: "ID", hideOnMobile: true, sortValue: (t) => t.id, cell: (t) => <span className="font-mono text-xs text-muted-foreground">{t.id}</span> },
    { id: "title", header: "Title", sortValue: (t) => t.title, cell: (t) => <span className="font-medium">{t.title}</span> },
    { id: "category", header: "Category", hideOnMobile: true, sortValue: (t) => t.category ?? "", cell: (t) => t.category || <span className="text-subtle">—</span> },
    {
      id: "priority",
      header: "Priority",
      sortValue: (t) => t.priority,
      cell: (t) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${priorityTone(t.priority)}`}>{t.priority}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (t) => t.status,
      cell: (t) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${statusTone(t.status)}`}>
          {t.status.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "due",
      header: "Due",
      hideOnMobile: true,
      sortValue: (t) => t.dueAt ?? "",
      cell: (t) => (t.dueAt ? <span className="whitespace-nowrap text-muted-foreground">{new Date(t.dueAt).toLocaleDateString()}</span> : <span className="text-subtle">—</span>),
    },
    {
      id: "updated",
      header: "Updated",
      align: "right",
      sortValue: (t) => t.updatedAt,
      cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{new Date(t.updatedAt).toLocaleDateString()}</span>,
    },
  ];

  const urgent = filtered.filter((t) => t.priority === "urgent").length;
  const openCount = filtered.filter((t) => t.status !== "resolved" && t.status !== "closed" && t.status !== "rejected").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Support tickets"
        description="Issues raised by clients and colleagues, and where each one stands."
        breadcrumbs={[{ label: "Support", to: "/support" }, { label: "Tickets" }]}
        actions={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New ticket
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Tickets" value={filtered.length} hint="Matching current filters" icon={LifeBuoy} />
          <StatCard label="Open" value={openCount} hint="Not yet resolved" icon={Clock} tone={openCount ? "info" : "neutral"} />
          <StatCard label="Urgent" value={urgent} hint={urgent ? "Need attention now" : "Nothing urgent"} icon={AlertCircle} tone={urgent ? "danger" : "neutral"} />
        </div>
      </PageHeader>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(t) => t.id}
        searchAccessor={(t) => `${t.id} ${t.title} ${t.description ?? ""} ${t.category ?? ""}`}
        searchPlaceholder="Search by title or description…"
        onRowClick={(t) => navigate(`/support/tickets/${t.id}`)}
        toolbar={
          <>
            <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "all" : (v as TicketStatus))}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v === "all" ? "all" : (v as Priority))}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {priorityOptions.map((pr) => <SelectItem key={pr} value={pr}>{pr}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assignee} onValueChange={(v) => setAssignee(v as typeof assignee)}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Assignee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="me">Assigned to me</SelectItem>
                {UsersStore.list().map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        empty={{
          title: "No tickets",
          description: "Raise a ticket to track an issue through to resolution.",
          action: <Button onClick={startAdd}>New ticket</Button>,
        }}
      />


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>New Ticket</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={form.title} onChange={(e)=> setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={form.category} onValueChange={(v)=> setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SupportStore.settings().categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea value={form.description} onChange={(e)=> setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Priority</label>
              <Select value={form.priority} onValueChange={(v)=> setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tickets;

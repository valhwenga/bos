import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupportStore, type Ticket, type Priority, type TicketStatus } from "@/lib/supportStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { UserStore } from "@/lib/userStore";
import { UsersStore } from "@/lib/usersStore";

const statusOptions: TicketStatus[] = ["open","in_progress","waiting","resolved","pending_approval","closed","rejected"];
const priorityOptions: Priority[] = ["low","medium","high","urgent"];

const Tickets = () => {
  const [list, setList] = useState<Ticket[]>(SupportStore.list());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState<string | "all" | "unassigned" | "me">("all");
  const [form, setForm] = useState<Ticket>({ id: "", title: "", description: "", requester: "user", priority: "medium", status: "open", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [], attachments: [], category: "General", closureRequest: null, approval: null });

  const refresh = () => setList(SupportStore.list());
  useEffect(()=>{ refresh(); }, []);

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
    setForm({ id: `T${Math.floor(Math.random()*90000+10000)}`, title: "", description: "", requester: me.id, priority: "medium", status: "open", createdAt: now.toISOString(), updatedAt: now.toISOString(), dueAt: due, comments: [], attachments: [], category: s.categories[0] || "General", closureRequest: null, approval: null }); setOpen(true); };
  const save = () => {
    if (!form.title.trim()) return;
    const s = SupportStore.settings();
    const now = new Date();
    const slaHrs = s.slaTargets[form.priority];
    const due = new Date(now.getTime() + slaHrs*3600000).toISOString();
    const data = { ...form, requester: me.id, createdAt: now.toISOString(), updatedAt: now.toISOString(), dueAt: due };
    SupportStore.upsert(data);
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "user", entity: "ticket", entityId: data.id, action: "create", details: data.title });
    setOpen(false);
    refresh();
  };

  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Support Tickets</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>Support</span>
            <span>›</span>
            <span>Tickets</span>
          </div>
        </div>
        <Button size="sm" onClick={startAdd}><Plus className="w-4 h-4 mr-2" />New Ticket</Button>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by title or description..." value={q} onChange={(e)=> setQ(e.target.value)} className="pl-9 w-72" />
        </div>
        <Select value={status} onValueChange={(v)=> setStatus(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v)=> setPriority(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {priorityOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={(v)=> setAssignee(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            <SelectItem value="me">Assigned to Me</SelectItem>
            {UsersStore.list().map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-sm font-semibold">ID</th>
                <th className="text-left p-4 text-sm font-semibold">TITLE</th>
                <th className="text-left p-4 text-sm font-semibold">CATEGORY</th>
                <th className="text-left p-4 text-sm font-semibold">PRIORITY</th>
                <th className="text-left p-4 text-sm font-semibold">STATUS</th>
                <th className="text-left p-4 text-sm font-semibold">DUE</th>
                <th className="text-left p-4 text-sm font-semibold">UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={()=> navigate(`/support/tickets/${t.id}`)}>
                  <td className="p-4 text-sm">{t.id}</td>
                  <td className="p-4 font-medium">{t.title}</td>
                  <td className="p-4 text-sm">{t.category}</td>
                  <td className="p-4 text-sm capitalize">
                    <span className={`px-2 py-1 rounded text-xs ${t.priority==='urgent'?'bg-red-500 text-white':t.priority==='high'?'bg-orange-500 text-white':t.priority==='medium'?'bg-yellow-500 text-white':'bg-green-500 text-white'}`}>{t.priority}</span>
                  </td>
                  <td className="p-4 text-sm capitalize">
                    <span className={`px-2 py-1 rounded text-xs ${t.status==='pending_approval'?'bg-blue-500 text-white':t.status==='closed'?'bg-gray-500 text-white':t.status==='rejected'?'bg-red-600 text-white':t.status==='resolved'?'bg-emerald-600 text-white':t.status==='in_progress'?'bg-indigo-600 text-white':t.status==='waiting'?'bg-yellow-600 text-white':'bg-slate-500 text-white'}`}>{t.status.replace(/_/g,' ')}</span>
                  </td>
                  <td className="p-4 text-sm">{t.dueAt ? new Date(t.dueAt).toLocaleString() : '-'}</td>
                  <td className="p-4 text-sm">{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-6 text-sm text-muted-foreground" colSpan={7}>No tickets found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SupportStore, type Ticket, type Priority } from "@/lib/supportStore";
import { UserStore } from "@/lib/userStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const priorityOptions: Priority[] = ["low","medium","high","urgent"];

const ClientTickets = () => {
  const me = UserStore.get();
  const [list, setList] = useState<Ticket[]>(SupportStore.list().filter(t => t.requester===me.id));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Ticket>({ id: "", title: "", description: "", requester: me.id, priority: "medium", status: "open", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [], attachments: [], category: SupportStore.settings().categories[0] || "General", closureRequest: null, approval: null });

  const refresh = () => setList(SupportStore.list().filter(t => t.requester===me.id));
  useEffect(()=>{ refresh(); }, []);

  const filtered = useMemo(() => list.filter(t => {
    const hay = `${t.id} ${t.title} ${t.description} ${t.category} ${t.status}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q]);

  const startAdd = () => {
    const s = SupportStore.settings();
    setForm({ id: `C${Math.floor(Math.random()*90000+10000)}`, title: "", description: "", requester: me.id, priority: "medium", status: "open", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), comments: [], attachments: [], category: s.categories[0] || "General", closureRequest: null, approval: null });
    setOpen(true);
  };
  const save = () => {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    const data = { ...form, requester: me.id, createdAt: now, updatedAt: now };
    SupportStore.upsert(data);
    setOpen(false);
    refresh();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Support Tickets</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Portal</span>
            <span>›</span>
            <span>Support</span>
          </div>
        </div>
        <Button size="sm" onClick={startAdd}>New Ticket</Button>
      </div>

      <div className="mb-4">
        <Input placeholder="Search by title or description..." value={q} onChange={(e)=> setQ(e.target.value)} className="w-full md:w-96" />
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
                <th className="text-left p-4 text-sm font-semibold">UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-t border-border">
                  <td className="p-4 text-sm">{t.id}</td>
                  <td className="p-4 font-medium">{t.title}</td>
                  <td className="p-4 text-sm">{t.category}</td>
                  <td className="p-4 text-sm capitalize">{t.priority}</td>
                  <td className="p-4 text-sm capitalize">{t.status.replace(/_/g,' ')}</td>
                  <td className="p-4 text-sm">{new Date(t.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-6 text-sm text-muted-foreground" colSpan={6}>No tickets</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[800px]">
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

export default ClientTickets;

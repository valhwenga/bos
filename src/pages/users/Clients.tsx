import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientsStore, type Client } from "@/lib/clientsStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Clients = () => {
  const [list, setList] = useState<Client[]>(ClientsStore.list());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Client>({ id: "", name: "", email: "", company: "", phone: "", status: "active", createdAt: new Date().toISOString() });

  const refresh = () => setList(ClientsStore.list());
  useEffect(()=>{ refresh(); }, []);

  const startAdd = () => { setEditing(null); setForm({ id: `c_${Math.random().toString(36).slice(2,8)}`, name: "", email: "", company: "", phone: "", status: "active", createdAt: new Date().toISOString() }); setOpen(true); };
  const startEdit = (c: Client) => { setEditing(c); setForm(c); setOpen(true); };
  const remove = (id: string) => { ClientsStore.remove(id); AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "client", entityId: id, action: "delete" }); refresh(); };
  const save = () => { if (!form.name.trim()) return; const data = { ...form, createdAt: editing ? form.createdAt : new Date().toISOString() }; ClientsStore.upsert(data); AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "client", entityId: data.id, action: editing ? "update" : "create" }); setOpen(false); refresh(); };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Clients</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>Users</span>
            <span>›</span>
            <span>Clients</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Search clients by name, email, or company..." className="w-full md:w-96" />
          </div>
        </div>
        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">NAME</th>
                <th className="text-left p-4 font-semibold text-sm">EMAIL</th>
                <th className="text-left p-4 font-semibold text-sm">COMPANY</th>
                <th className="text-left p-4 font-semibold text-sm">PHONE</th>
                <th className="text-left p-4 font-semibold text-sm">STATUS</th>
                <th className="text-right p-4 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {list.filter(c => {
                const hay = `${c.name} ${c.email||''} ${c.company||''}`.toLowerCase();
                return hay.includes(q.toLowerCase());
              }).map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-4 font-medium">{c.name}</td>
                  <td className="p-4">{c.email||'-'}</td>
                  <td className="p-4">{c.company||'-'}</td>
                  <td className="p-4">{c.phone||'-'}</td>
                  <td className="p-4 capitalize">{c.status}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={()=> startEdit(c)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={()=> remove(c.id)}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Client' : 'Add Client'}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={form.name} onChange={(e)=> setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={form.email||''} onChange={(e)=> setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Company</label>
              <Input value={form.company||''} onChange={(e)=> setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={form.phone||''} onChange={(e)=> setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v)=> setForm({ ...form, status: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;

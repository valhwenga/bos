import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UsersStore, type AppUser } from "@/lib/usersStore";
import { RolesStore, type Role } from "@/lib/rolesStore";
import { Switch } from "@/components/ui/switch";
import { AuditLogStore } from "@/lib/auditLogStore";

const ManageUsers = () => {
  const [users, setUsers] = useState<AppUser[]>(UsersStore.list());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<AppUser>({ id: "", name: "", email: "", roleId: "", status: "active", twoFactorEnabled: false, createdAt: new Date().toISOString() });

  const roles = RolesStore.list();
  const roleMap = useMemo(() => Object.fromEntries(roles.map(r => [r.id, r])), [roles]);

  const refresh = () => setUsers(UsersStore.list());
  useEffect(() => { refresh(); }, []);

  const startAdd = () => { setEditing(null); setForm({ id: `u_${Math.random().toString(36).slice(2,8)}`, name: "", email: "", roleId: roles[0]?.id || "", status: "active", twoFactorEnabled: false, createdAt: new Date().toISOString() }); setOpen(true); };
  const startEdit = (u: AppUser) => { setEditing(u); setForm(u); setOpen(true); };
  const remove = (id: string) => { UsersStore.remove(id); AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "user", entityId: id, action: "delete" }); refresh(); };
  const save = () => {
    if (!form.name.trim() || !form.email.trim() || !form.roleId) return;
    const role = roleMap[form.roleId];
    const enforce2fa = role?.require2FA ? true : form.twoFactorEnabled;
    const data: AppUser = { ...form, twoFactorEnabled: enforce2fa, createdAt: editing ? form.createdAt : new Date().toISOString() };
    UsersStore.upsert(data);
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "user", entityId: data.id, action: editing ? "update" : "create" });
    setOpen(false);
    refresh();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>Users</span>
          </div>
      <div className="mt-4 flex items-center gap-2">
        <Input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Search users by name, email, or role..." className="w-full md:w-96" />
      </div>
        </div>
        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">NAME</th>
                <th className="text-left p-4 font-semibold text-sm">EMAIL</th>
                <th className="text-left p-4 font-semibold text-sm">ROLE</th>
                <th className="text-left p-4 font-semibold text-sm">LEVEL</th>
                <th className="text-left p-4 font-semibold text-sm">2FA</th>
                <th className="text-left p-4 font-semibold text-sm">STATUS</th>
                <th className="text-right p-4 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => {
                const role = roleMap[u.roleId];
                const hay = `${u.name} ${u.email} ${role?.name||''}`.toLowerCase();
                return hay.includes(q.toLowerCase());
              }).map((u) => {
                const role = roleMap[u.roleId];
                return (
                  <tr key={u.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-medium">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4">{role?.name || u.roleId}</td>
                    <td className="p-4">{role?.level || "-"}</td>
                    <td className="p-4">
                      <div className={`inline-flex items-center gap-1 text-xs ${u.twoFactorEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                        <Shield className="w-3 h-3" /> {u.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </td>
                    <td className="p-4 capitalize">{u.status}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={()=> startEdit(u)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={()=> remove(u.id)}>
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Full Name</label>
              <Input value={form.name} onChange={(e)=> setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={form.email} onChange={(e)=> setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Role</label>
              <Select value={form.roleId} onValueChange={(v)=> setForm({ ...form, roleId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Two-Factor Authentication</label>
                <Switch checked={!!form.twoFactorEnabled} onCheckedChange={(v)=> setForm({ ...form, twoFactorEnabled: v })} />
              </div>
              <p className="text-xs text-muted-foreground">Some roles may require 2FA and will enforce it automatically on save.</p>
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

export default ManageUsers;

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
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
  const remove = (id: string) => {
    const ok = window.confirm("Delete this user? This action cannot be undone.");
    if (!ok) return;
    UsersStore.remove(id);
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "user", entityId: id, action: "delete" });
    refresh();
  };
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

  const columns: Column<AppUser>[] = [
    { id: "name", header: "Name", sortValue: (u) => u.name, cell: (u) => <span className="font-medium">{u.name}</span> },
    { id: "email", header: "Email", sortValue: (u) => u.email, cell: (u) => <span className="text-muted-foreground">{u.email}</span> },
    {
      id: "role",
      header: "Role",
      sortValue: (u) => roleMap[u.roleId]?.name ?? u.roleId,
      cell: (u) => roleMap[u.roleId]?.name || u.roleId,
    },
    { id: "level", header: "Level", hideOnMobile: true, sortValue: (u) => roleMap[u.roleId]?.level ?? "", cell: (u) => roleMap[u.roleId]?.level || "—" },
    {
      id: "twofa",
      header: "2FA",
      hideOnMobile: true,
      sortValue: (u) => (u.twoFactorEnabled ? 1 : 0),
      cell: (u) => (
        <span className={`inline-flex items-center gap-1 text-xs ${u.twoFactorEnabled ? "text-success" : "text-muted-foreground"}`}>
          <Shield className="h-3 w-3" aria-hidden="true" />
          {u.twoFactorEnabled ? "On" : "Off"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (u) => u.status,
      cell: (u) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${u.status === "active" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          {u.status}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (u) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(u)} aria-label={`Edit ${u.name}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => remove(u.id)} aria-label={`Delete ${u.name}`}>
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = users.filter((u) => u.status === "active").length;
  const without2fa = users.filter((u) => !u.twoFactorEnabled).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Users"
        description="Who can sign in, and what each person's role lets them reach."
        breadcrumbs={[{ label: "Users", to: "/users" }, { label: "All users" }]}
        actions={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add user
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Users" value={users.length} hint="With an account" icon={Users} />
          <StatCard label="Active" value={activeCount} hint={`${users.length - activeCount} inactive`} icon={UserCheck} tone="success" />
          <StatCard
            label="Without 2FA"
            value={without2fa}
            hint={without2fa ? "Second factor not enabled" : "Everyone protected"}
            icon={Shield}
            tone={without2fa ? "warning" : "success"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={users}
        columns={columns}
        rowKey={(u) => u.id}
        searchAccessor={(u) => `${u.name} ${u.email} ${roleMap[u.roleId]?.name ?? ""}`}
        searchPlaceholder="Search by name, email or role…"
        onRowClick={startEdit}
        empty={{
          title: "No users yet",
          description: "Add someone and assign them a role to control what they can see.",
          action: <Button onClick={startAdd}>Add user</Button>,
        }}
      />

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
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'active'|'inactive' })}>
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

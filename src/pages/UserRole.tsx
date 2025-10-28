import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RolesStore, Modules, type Role, type AccessLevel, type RoleLevel } from "@/lib/rolesStore";
import { Separator } from "@/components/ui/separator";

const UserRole = () => {
  const [list, setList] = useState<Role[]>(RolesStore.list());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<Role>(() => ({ id: "", name: "", level: "Team", description: "", access: Object.fromEntries(Modules.map(m=> [m.key, "none"])) as any }));

  const refresh = () => setList(RolesStore.list());
  const startAdd = () => { setEditing(null); setForm({ id: `role_${Math.random().toString(36).slice(2,8)}`, name: "", level: "Team", description: "", access: Object.fromEntries(Modules.map(m=> [m.key, "none"])) as any }); setOpen(true); };
  const startEdit = (r: Role) => { setEditing(r); setForm(r); setOpen(true); };
  const remove = (id: string) => { RolesStore.remove(id); refresh(); };
  const save = () => { if (!form.name.trim()) return; RolesStore.upsert(form); setOpen(false); refresh(); };

  const levelOptions: RoleLevel[] = ["Global","Company","Department","Team","External"];
  const accessOptions: { v: AccessLevel; label: string }[] = [
    { v: "full", label: "Full Access" },
    { v: "edit", label: "Edit Access" },
    { v: "view", label: "View Only" },
    { v: "none", label: "No Access" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Role</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>Role</span>
          </div>
        </div>

        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Role
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select defaultValue="10">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries per page</span>
          </div>

          <div className="flex items-center gap-2">
            <Input type="search" placeholder="Search..." className="w-64" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">ROLE</th>
                <th className="text-left p-4 font-semibold text-sm">PERMISSIONS</th>
                <th className="text-right p-4 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {list.map((role, index) => (
                <tr key={index} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{role.name}</span>
                      <span className="text-xs text-muted-foreground">{role.level}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {Modules.map(m => (
                        <div key={m.key} className="text-xs flex items-center justify-between gap-2 border rounded px-2 py-1">
                          <span className="truncate" title={m.label}>{m.label}</span>
                          <span className="font-medium capitalize">{role.access[m.key]}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={()=> startEdit(role)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={()=> remove(role.id)}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {list.length} roles</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
              1
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[1100px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Role" : "Add Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Role Name</label>
                <Input value={form.name} onChange={(e)=> setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Level</label>
                <Select value={form.level} onValueChange={(v)=> setForm({ ...form, level: v as RoleLevel })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOptions.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Session Timeout (min)</label>
                <Input type="number" value={form.security?.sessionTimeoutMinutes ?? 30} onChange={(e)=> setForm({ ...form, security: { ...(form.security||{}), sessionTimeoutMinutes: parseInt(e.target.value||"0") } })} />
              </div>
              <div className="grid gap-1 md:col-span-3">
                <label className="text-xs text-muted-foreground">Description</label>
                <Input value={form.description || ""} onChange={(e)=> setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid gap-1 md:col-span-3">
                <label className="text-xs text-muted-foreground">Allowed IP CIDRs (comma separated)</label>
                <Input value={(form.security?.allowedIpCidrs || []).join(", ")} onChange={(e)=> setForm({ ...form, security: { ...(form.security||{}), allowedIpCidrs: e.target.value.split(/\s*,\s*/).filter(Boolean) } })} />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Access Matrix</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Modules.map(m => (
                  <div key={m.key} className="border rounded p-3">
                    <div className="text-sm mb-2">{m.label}</div>
                    <Select value={form.access[m.key]} onValueChange={(v)=> setForm({ ...form, access: { ...form.access, [m.key]: v as AccessLevel } })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessOptions.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
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

export default UserRole;

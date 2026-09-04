/**
 * The access matrix.
 *
 * This screen edits what the database enforces. `roles` and `role_access` are
 * what `has_access()` reads, and every row level security policy is built on
 * that function — so a change saved here changes what the server will return to
 * everyone holding the role, not merely what their sidebar shows.
 *
 * It used to write to localStorage, which meant it changed nothing at all, and
 * displayed seed data rather than the permissions actually in force.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useCache } from "@/lib/collectionCache";
import { RolesStore, rolesCache, Modules, type Role, type AccessLevel, type RoleLevel } from "@/lib/rolesStore";
import { useAccounts } from "@/lib/useAccounts";
import { getCurrentRole } from "@/lib/accessControl";
import { toast } from "@/components/ui/use-toast";

const levelOptions: RoleLevel[] = ["Global", "Company", "Department", "Team", "External"];

const accessOptions: { v: AccessLevel; label: string }[] = [
  { v: "full", label: "Full Access" },
  { v: "edit", label: "Edit Access" },
  { v: "view", label: "View Only" },
  { v: "none", label: "No Access" },
];

const emptyAccess = () =>
  Object.fromEntries(Modules.map((m) => [m.key, "none" as AccessLevel])) as Record<string, AccessLevel>;

const blankRole = (): Role => ({
  id: `role_${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  level: "Team",
  description: "",
  access: emptyAccess() as Role["access"],
  require2FA: false,
  security: { sessionTimeoutMinutes: 30 },
});

const accessTone = (level: AccessLevel) =>
  level === "full"
    ? "text-success"
    : level === "edit"
      ? "text-info"
      : level === "view"
        ? "text-muted-foreground"
        : "text-subtle";

const UserRole = () => {
  const { loading, error } = useCache(rolesCache);
  const list = RolesStore.list();
  const accounts = useAccounts();
  const myRole = getCurrentRole();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<Role>(blankRole);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  /** How many people hold each role, so deleting one is an informed decision. */
  const holders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of accounts) {
      if (a.roleId) counts.set(a.roleId, (counts.get(a.roleId) ?? 0) + 1);
    }
    return counts;
  }, [accounts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => `${r.name} ${r.level} ${r.description ?? ""}`.toLowerCase().includes(needle));
  }, [list, q]);

  const startAdd = () => {
    setEditing(null);
    setForm(blankRole());
    setFormError("");
    setOpen(true);
  };

  const startEdit = (r: Role) => {
    setEditing(r);
    setForm({ ...r, access: { ...r.access }, security: { ...(r.security ?? {}) } });
    setFormError("");
    setOpen(true);
  };

  const remove = async (r: Role) => {
    const held = holders.get(r.id) ?? 0;
    const warning = held
      ? `${r.name} is held by ${held} ${held === 1 ? "person" : "people"}. Move them to another role first.`
      : `Delete ${r.name}? Anyone assigned to it would lose all access.`;
    if (held) {
      toast({ title: "Role in use", description: warning, variant: "destructive" });
      return;
    }
    if (!window.confirm(warning)) return;
    try {
      await RolesStore.remove(r.id);
      toast({ title: "Role deleted", description: `${r.name} is gone.` });
    } catch (e: unknown) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "The server refused.",
        variant: "destructive",
      });
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError("A role needs a name.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await RolesStore.upsert({ ...form, name: form.name.trim() });
      setOpen(false);
      toast({
        title: editing ? "Permissions updated" : "Role created",
        description:
          editing && editing.id === myRole.id
            ? "You changed your own role. Sign out and back in for it to take effect everywhere."
            : `${form.name.trim()} is saved.`,
      });
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Could not save this role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Roles &amp; permissions</h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Users</span>
            <span>›</span>
            <span className="text-foreground">Roles</span>
          </div>
        </div>

        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add role
        </Button>
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        What each role can reach. Saving here changes what the server allows, not just what the app shows.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          Could not load roles: {error.message}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {loading && list.length === 0 ? "Loading…" : `${filtered.length} of ${list.length} roles`}
          </span>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search roles…"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
              {filtered.map((role) => {
                const held = holders.get(role.id) ?? 0;
                return (
                  <tr key={role.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="p-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium flex items-center gap-1.5">
                          {role.name}
                          {role.isSystem && (
                            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Built in" />
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{role.level}</span>
                        <span className="text-xs text-muted-foreground">
                          {held ? `${held} ${held === 1 ? "person" : "people"}` : "Nobody assigned"}
                          {role.require2FA ? " • 2FA required" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Modules.map((m) => (
                          <div
                            key={m.key}
                            className="text-xs flex items-center justify-between gap-2 border rounded px-2 py-1"
                          >
                            <span className="truncate" title={m.label}>
                              {m.label}
                            </span>
                            <span className={`font-medium capitalize ${accessTone(role.access[m.key])}`}>
                              {role.access[m.key]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-info hover:text-info hover:bg-info-soft"
                          onClick={() => startEdit(role)}
                          aria-label={`Edit ${role.name}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-danger hover:text-danger hover:bg-danger-soft"
                          onClick={() => remove(role)}
                          disabled={role.isSystem}
                          aria-label={role.isSystem ? `${role.name} is built in` : `Delete ${role.name}`}
                          title={role.isSystem ? "Built-in roles cannot be deleted" : undefined}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                    No roles match “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[1100px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editing?.id === "role_super_admin" && (
              <div className="rounded-md border border-info/40 bg-info-soft px-3 py-2 text-xs text-info">
                Super Admin always keeps full access to every module. It is the way back in if another role is
                saved wrong, so the database will not let that access be reduced.
              </div>
            )}
            {editing && editing.id === myRole.id && (
              <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
                This is your own role. Taking access away here takes it away from you.
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Role name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Level</label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as RoleLevel })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOptions.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Session timeout (minutes)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.security?.sessionTimeoutMinutes ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      security: {
                        ...(form.security ?? {}),
                        sessionTimeoutMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      },
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">Blank or 0 means the session does not expire.</p>
              </div>
              <div className="grid gap-1 md:col-span-3">
                <label className="text-xs text-muted-foreground">Description</label>
                <Input
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-3 flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm">Require two-factor authentication</div>
                  <p className="text-xs text-muted-foreground">
                    Anyone with this role must set up an authenticator app before they can use the system.
                  </p>
                </div>
                <Switch
                  checked={!!form.require2FA}
                  onCheckedChange={(v) => setForm({ ...form, require2FA: v })}
                />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Access matrix</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Modules.map((m) => (
                  <div key={m.key} className="border rounded p-3">
                    <div className="text-sm mb-2">{m.label}</div>
                    <Select
                      value={form.access[m.key]}
                      onValueChange={(v) =>
                        setForm({ ...form, access: { ...form.access, [m.key]: v as AccessLevel } })
                      }
                      disabled={editing?.id === "role_super_admin"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessOptions.map((o) => (
                          <SelectItem key={o.v} value={o.v}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {formError && <p className="text-sm text-danger">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserRole;

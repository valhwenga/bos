/**
 * Staff accounts.
 *
 * This screen used to keep its own list in localStorage, so "Add user" created
 * a row that could not sign in, and the list showed nobody who actually could.
 * It reads and writes the real accounts now: adding one goes through the
 * admin-create-user function (creating a login needs the service key, which the
 * browser must never hold), and role and status changes go to the profile.
 *
 * There is no delete. Removing an auth user from the browser is not something
 * the client is allowed to do, and it would orphan every row that references
 * them — the invoices they raised, the tickets they answered. Deactivating ends
 * their access and keeps the history readable.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Shield, Users, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useCache } from "@/lib/collectionCache";
import { RolesStore, rolesCache } from "@/lib/rolesStore";
import { AuthStore, type Account } from "@/lib/authStore";
import { useAccounts, invalidateAccounts } from "@/lib/useAccounts";
import { AuditLogStore } from "@/lib/auditLogStore";
import { toast } from "@/components/ui/use-toast";

/** A password for a new account, shown once so the admin can pass it on. */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

const audit = (entityId: string, action: "create" | "update", details?: string) => {
  // Who and when are stamped by the database from the session; passing them
  // from here recorded whatever the call site happened to type.
  void AuditLogStore.append({ entity: "user", entityId, action, details });
};

const ManageUsers = () => {
  const users = useAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Set after creating an account, so the password is shown exactly once. */
  const [newPassword, setNewPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<Account["status"]>("active");

  useCache(rolesCache);
  const roles = RolesStore.list();
  const roleMap = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles]);

  const startAdd = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setRoleId(roles[0]?.id ?? "");
    setStatus("active");
    setError("");
    setNewPassword("");
    setOpen(true);
  };

  const startEdit = (u: Account) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setRoleId(u.roleId ?? "");
    setStatus(u.status);
    setError("");
    setNewPassword("");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !email.trim() || !roleId) {
      setError("Name, email and role are all required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editing) {
        // Only send what changed; each is a separate server-side check.
        if (roleId !== editing.roleId) {
          await AuthStore.setAccountRole(editing.id, roleId);
          audit(editing.id, "update", `role=${roleId}`);
        }
        if (status !== editing.status) {
          await AuthStore.setAccountActive(editing.id, status === "active");
          audit(editing.id, "update", `status=${status}`);
        }
        invalidateAccounts();
        setOpen(false);
        toast({ title: "User updated", description: `${editing.name}'s access has been changed.` });
      } else {
        const password = generateTempPassword();
        const created = await AuthStore.createUser({
          name: name.trim(),
          email: email.trim(),
          password,
          roleId,
        });
        audit(created.id, "create", email.trim());
        invalidateAccounts();
        // The dialog stays open: this password is not recoverable afterwards.
        setNewPassword(password);
        toast({ title: "User created", description: `${name.trim()} can now sign in.` });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save this user.");
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Account>[] = [
    { id: "name", header: "Name", sortValue: (u) => u.name, cell: (u) => <span className="font-medium">{u.name}</span> },
    { id: "email", header: "Email", sortValue: (u) => u.email, cell: (u) => <span className="text-muted-foreground">{u.email}</span> },
    {
      id: "role",
      header: "Role",
      sortValue: (u) => (u.roleId ? roleMap[u.roleId]?.name ?? u.roleId : ""),
      cell: (u) => (u.roleId ? roleMap[u.roleId]?.name ?? u.roleId : <span className="text-muted-foreground">No role</span>),
    },
    {
      id: "level",
      header: "Level",
      hideOnMobile: true,
      sortValue: (u) => (u.roleId ? roleMap[u.roleId]?.level ?? "" : ""),
      cell: (u) => (u.roleId ? roleMap[u.roleId]?.level ?? "—" : "—"),
    },
    {
      // Whether this person has enrolled a second factor is theirs to see, not
      // ours; what an admin can act on is whether their role demands one.
      id: "twofa",
      header: "2FA required",
      hideOnMobile: true,
      sortValue: (u) => (u.roleId && roleMap[u.roleId]?.require2FA ? 1 : 0),
      cell: (u) => {
        const required = !!(u.roleId && roleMap[u.roleId]?.require2FA);
        return (
          <span className={`inline-flex items-center gap-1 text-xs ${required ? "text-success" : "text-muted-foreground"}`}>
            <Shield className="h-3 w-3" aria-hidden="true" />
            {required ? "Yes" : "No"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      sortValue: (u) => u.status,
      cell: (u) => (
        <span
          className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${
            u.status === "active" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
          }`}
        >
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
        </div>
      ),
    },
  ];

  const activeCount = users.filter((u) => u.status === "active").length;
  const pendingCount = users.filter((u) => u.status === "pending").length;

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
          <StatCard
            label="Active"
            value={activeCount}
            hint={`${users.length - activeCount} not active`}
            icon={UserCheck}
            tone="success"
          />
          <StatCard
            label="Awaiting approval"
            value={pendingCount}
            hint={pendingCount ? "Signed up, no role yet" : "Nobody waiting"}
            icon={Shield}
            tone={pendingCount ? "warning" : "success"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={users}
        columns={columns}
        rowKey={(u) => u.id}
        searchAccessor={(u) => `${u.name} ${u.email} ${(u.roleId && roleMap[u.roleId]?.name) ?? ""}`}
        searchPlaceholder="Search by name, email or role…"
        onRowClick={startEdit}
        empty={{
          title: "No users yet",
          description: "Add someone and assign them a role to control what they can see.",
          action: <Button onClick={startAdd}>Add user</Button>,
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>

          {newPassword ? (
            <div className="grid gap-2">
              <p className="text-sm">
                <span className="font-medium">{name}</span> can sign in with the password below. It is shown only
                now — copy it before closing.
              </p>
              <code className="rounded-md bg-muted px-3 py-2 font-mono text-sm">{newPassword}</code>
              <p className="text-xs text-muted-foreground">
                Ask them to change it once they are in, under their profile.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Full name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!!editing} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editing} />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Role</label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={status} onValueChange={(v) => setStatus(v as Account["status"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing && (
                <p className="md:col-span-2 text-xs text-muted-foreground">
                  Name and email belong to the person's own profile. Setting someone inactive ends their access
                  without removing what they have already done.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            {newPassword ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageUsers;

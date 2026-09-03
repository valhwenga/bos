import { useEffect, useMemo, useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { ticketsCache } from "@/lib/supportStore";
import { clientsCache } from "@/lib/clientsStore";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, KeyRound } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ClientsStore, type Client } from "@/lib/clientsStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthStore, type Account } from "@/lib/authStore";
import { useAccounts, invalidateAccounts } from "@/lib/useAccounts";
import { RolesStore } from "@/lib/rolesStore";

const Clients = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(ticketsCache);
  useCache(clientsCache);
  const [list, setList] = useState<Client[]>(ClientsStore.list());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Client>({ id: "", name: "", email: "", company: "", phone: "", status: "active", createdAt: new Date().toISOString() });

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginClient, setLoginClient] = useState<Client | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginRoleId, setLoginRoleId] = useState("role_client");
  const [loginTempPass, setLoginTempPass] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  const refresh = () => setList(ClientsStore.list());
  useEffect(()=>{ refresh(); }, []);

  const roles = RolesStore.list();
  const externalRoles = roles.filter(r => r.level === "External");

  const accounts = useAccounts();
  const accountByClientId = useMemo(() => {
    const map: Record<string, Account> = {};
    accounts.forEach(a => { if (a.clientId) map[a.clientId] = a; });
    return map;
  }, [accounts]);

  const startAdd = () => { setEditing(null); setForm({ id: `c_${Math.random().toString(36).slice(2,8)}`, name: "", email: "", company: "", phone: "", status: "active", createdAt: new Date().toISOString() }); setOpen(true); };
  const startEdit = (c: Client) => { setEditing(c); setForm(c); setOpen(true); };
  const startCreateLogin = (c: Client) => {
    setLoginClient(c);
    setLoginEmail(c.email || "");
    setLoginName(c.name);
    setLoginRoleId(externalRoles.find(r => r.id === "role_client")?.id || externalRoles[0]?.id || "role_client");
    setLoginTempPass("");
    setLoginError("");
    setLoginOpen(true);
  };
  const remove = (id: string) => {
    const ok = window.confirm("Delete this client? This action cannot be undone.");
    if (!ok) return;
    void ClientsStore.remove(id);
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "client", entityId: id, action: "delete" });
    refresh();
  };
  const save = () => { if (!form.name.trim()) return; const data = { ...form, createdAt: editing ? form.createdAt : new Date().toISOString() }; void ClientsStore.upsert(data); AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "client", entityId: data.id, action: editing ? "update" : "create" }); setOpen(false); refresh(); };

  const generateTempPassword = () => {
    const p = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
    setLoginTempPass(p);
    return p;
  };

  const createLogin = async () => {
    if (!loginClient) return;
    setLoginError("");
    if (!loginName.trim() || !loginEmail.trim()) { setLoginError("Name and email are required."); return; }
    if (!externalRoles.find(r => r.id === loginRoleId)) { setLoginError("Please select an external/client role."); return; }
    const pass = loginTempPass || generateTempPassword();
    try {
      // Creating another user needs the service key, so this goes through the
      // admin-create-user function rather than happening in the browser.
      const acc = await AuthStore.createClientAccount({
        name: loginName.trim(),
        email: loginEmail.trim(),
        password: pass,
        roleId: loginRoleId,
        clientId: loginClient.id,
      });
      AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "auth.account", entityId: acc.id, action: "create", details: `clientId=${loginClient.id}` });
      invalidateAccounts();
      setLoginTempPass(pass);
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : "Failed to create login");
      return;
    }
  };

  const toggleAccountActive = (clientId: string) => {
    const acc = accountByClientId[clientId];
    if (!acc) return;
    AuthStore.setAccountActive(acc.id, !acc.active);
  };

  const columns: Column<Client>[] = [
    { id: "name", header: "Name", sortValue: (c) => c.name, cell: (c) => <span className="font-medium">{c.name}</span> },
    { id: "email", header: "Email", sortValue: (c) => c.email ?? "", cell: (c) => c.email || <span className="text-subtle">—</span> },
    { id: "company", header: "Company", hideOnMobile: true, sortValue: (c) => c.company ?? "", cell: (c) => c.company || <span className="text-subtle">—</span> },
    { id: "phone", header: "Phone", hideOnMobile: true, cell: (c) => c.phone || <span className="text-subtle">—</span> },
    {
      id: "status",
      header: "Status",
      sortValue: (c) => c.status,
      cell: (c) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${c.status === "active" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          {c.status}
        </span>
      ),
    },
    {
      id: "login",
      header: "Portal login",
      sortValue: (c) => (accountByClientId[c.id] ? (accountByClientId[c.id].active ? 2 : 1) : 0),
      cell: (c) => {
        const account = accountByClientId[c.id];
        if (!account) return <span className="text-subtle">None</span>;
        return (
          <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium ${account.active ? "bg-info-soft text-info" : "bg-muted text-muted-foreground"}`}>
            {account.active ? "Enabled" : "Disabled"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (c) => (
        <div className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {accountByClientId[c.id] ? (
            <Button size="sm" variant="outline" className="h-8" onClick={() => toggleAccountActive(c.id)}>
              {accountByClientId[c.id].active ? "Disable login" : "Enable login"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8" onClick={() => startCreateLogin(c)}>
              Create login
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)} aria-label={`Edit ${c.name}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => remove(c.id)} aria-label={`Delete ${c.name}`}>
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const withLogin = list.filter((c) => !!accountByClientId[c.id]).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Clients"
        description="External contacts, and whether they can sign in to the client portal."
        breadcrumbs={[{ label: "Users", to: "/users" }, { label: "Clients" }]}
        actions={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add client
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Clients" value={list.length} hint="On record" icon={Briefcase} />
          <StatCard
            label="Portal access"
            value={withLogin}
            hint={`${list.length - withLogin} without a login`}
            icon={KeyRound}
            tone={withLogin ? "info" : "neutral"}
          />
        </div>
      </PageHeader>

      <DataTable
        rows={list}
        columns={columns}
        rowKey={(c) => c.id}
        searchAccessor={(c) => `${c.name} ${c.email ?? ""} ${c.company ?? ""} ${c.phone ?? ""}`}
        searchPlaceholder="Search by name, email or company…"
        onRowClick={startEdit}
        empty={{
          title: "No clients yet",
          description: "Add a client, then optionally give them a portal login to raise tickets.",
          action: <Button onClick={startAdd}>Add client</Button>,
        }}
      />

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
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Create Client Login</DialogTitle>
          </DialogHeader>
          {loginError && <div className="text-sm text-danger bg-danger-soft border border-danger rounded p-2">{loginError}</div>}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Client</label>
              <Input value={loginClient?.name || ""} disabled />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Access Level (Role)</label>
              <Select value={loginRoleId} onValueChange={setLoginRoleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {externalRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Full Name</label>
              <Input value={loginName} onChange={(e)=> setLoginName(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={loginEmail} onChange={(e)=> setLoginEmail(e.target.value)} />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Temporary Password</label>
              <div className="flex gap-2">
                <Input value={loginTempPass} onChange={(e)=> setLoginTempPass(e.target.value)} placeholder="Click Generate or type one" />
                <Button type="button" variant="secondary" onClick={generateTempPassword}>Generate</Button>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Share these credentials with the client. You can disable login anytime.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={()=> setLoginOpen(false)}>Close</Button>
            <Button onClick={() => void createLogin()} disabled={!loginClient}>Create Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;

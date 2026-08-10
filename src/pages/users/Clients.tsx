import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientsStore, type Client } from "@/lib/clientsStore";
import { AuditLogStore } from "@/lib/auditLogStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthStore, type Account } from "@/lib/authStore";
import { RolesStore } from "@/lib/rolesStore";

const Clients = () => {
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

  const accounts = AuthStore.listAccounts();
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
    ClientsStore.remove(id);
    AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "client", entityId: id, action: "delete" });
    refresh();
  };
  const save = () => { if (!form.name.trim()) return; const data = { ...form, createdAt: editing ? form.createdAt : new Date().toISOString() }; ClientsStore.upsert(data); AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "client", entityId: data.id, action: editing ? "update" : "create" }); setOpen(false); refresh(); };

  const generateTempPassword = () => {
    const p = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
    setLoginTempPass(p);
    return p;
  };

  const createLogin = () => {
    if (!loginClient) return;
    setLoginError("");
    if (!loginName.trim() || !loginEmail.trim()) { setLoginError("Name and email are required."); return; }
    if (!externalRoles.find(r => r.id === loginRoleId)) { setLoginError("Please select an external/client role."); return; }
    const pass = loginTempPass || generateTempPassword();
    try {
      const acc = AuthStore.createClientAccount({
        name: loginName.trim(),
        email: loginEmail.trim(),
        password: pass,
        roleId: loginRoleId,
        clientId: loginClient.id,
        active: true,
      });
      AuditLogStore.append({ id: crypto.randomUUID?.() || String(Date.now()), ts: new Date().toISOString(), actor: "admin", entity: "auth.account", entityId: acc.id, action: "create", details: `clientId=${loginClient.id}` });
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
                      {accountByClientId[c.id] ? (
                        <Button size="sm" variant="secondary" onClick={()=> toggleAccountActive(c.id)}>
                          {accountByClientId[c.id].active ? "Disable Login" : "Enable Login"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={()=> startCreateLogin(c)}>Create Login</Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-info hover:text-info hover:bg-info-soft" onClick={()=> startEdit(c)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-danger hover:text-danger hover:bg-danger-soft" onClick={()=> remove(c.id)}>
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
            <Button onClick={createLogin} disabled={!loginClient}>Create Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;

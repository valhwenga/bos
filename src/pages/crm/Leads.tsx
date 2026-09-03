import { useMemo, useState } from "react";
import { useCache } from "@/lib/collectionCache";
import { leadsCache } from "@/lib/crmLeadsStore";
import { dealsCache } from "@/lib/crmDealsStore";
import { crmCustomersCache } from "@/lib/crmCustomersStore";
import { crmTasksCache } from "@/lib/crmTasksStore";
import { UserPlus, UserX, CheckCircle2 } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CrmLeadsStore, type Lead, type LeadStage } from "@/lib/crmLeadsStore";
import { useAccounts, useStaffAccounts } from "@/lib/useAccounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button as UIButton } from "@/components/ui/button";

const stageOptions: { key: LeadStage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const Leads = () => {
  // Rows come from Postgres via caches, so this re-renders when they arrive.
  useCache(leadsCache);
  useCache(dealsCache);
  useCache(crmCustomersCache);
  useCache(crmTasksCache);
  const navigate = useNavigate();
  const [list, setList] = useState(CrmLeadsStore.list());
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<LeadStage | 'all'>('all');
  const users = useAccounts();
  const staff = useStaffAccounts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; company: string; email: string; phone: string; address: string; source: 'website'|'referral'|'campaign'|'manual'; ownerId: string }>({ name: "", company: "", email: "", phone: "", address: "", source: 'manual', ownerId: users[0]?.id||"" });

  const filtered = useMemo(() => list.filter(l => {
    const hay = `${l.name} ${l.company||''} ${l.email||''} ${l.phone||''}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
    if (stage !== 'all' && l.stage !== stage) return false;
    return true;
  }), [list, q, stage]);

  const add = () => setOpen(true);

  const save = () => {
    if (!form.name.trim() && !form.company.trim()) return;
    const l: Lead = {
      id: `L_${Date.now()}`,
      name: form.name || form.company,
      company: form.company || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      source: form.source,
      ownerId: form.ownerId || undefined,
      stage: 'new',
      activities: [],
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    void CrmLeadsStore.upsert(l);
    setList(CrmLeadsStore.list());
    setOpen(false);
    setForm({ name: "", company: "", email: "", phone: "", address: "", source: 'manual', ownerId: users[0]?.id||"" });
  };

  const stageTone = (stage: string) =>
    stage === "won" ? "bg-success-soft text-success"
    : stage === "lost" ? "bg-danger-soft text-danger"
    : stage === "new" ? "bg-info-soft text-info"
    : "bg-muted text-muted-foreground";

  const columns: Column<Lead>[] = [
    { id: "name", header: "Name", sortValue: (l) => l.name, cell: (l) => <span className="font-medium">{l.name}</span> },
    { id: "company", header: "Company", sortValue: (l) => l.company ?? "", cell: (l) => l.company || <span className="text-subtle">—</span> },
    {
      id: "contact",
      header: "Contact",
      hideOnMobile: true,
      cell: (l) => <span className="text-muted-foreground">{l.email || l.phone || "—"}</span>,
    },
    {
      id: "stage",
      header: "Stage",
      sortValue: (l) => l.stage,
      cell: (l) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium capitalize ${stageTone(l.stage)}`}>
          {l.stage.replace("_", " ")}
        </span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      hideOnMobile: true,
      sortValue: (l) => users.find((u) => u.id === l.ownerId)?.name ?? "",
      cell: (l) => users.find((u) => u.id === l.ownerId)?.name || <span className="text-subtle">Unassigned</span>,
    },
  ];

  const won = filtered.filter((l) => l.stage === "won").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Leads"
        description="People who've shown interest but aren't customers yet."
        breadcrumbs={[{ label: "CRM", to: "/crm/leads" }, { label: "Leads" }]}
        actions={<Button onClick={add}>New lead</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Leads" value={filtered.length} hint="Matching current filters" icon={UserPlus} />
          <StatCard label="Won" value={won} hint={won ? "Converted to customers" : "None yet"} icon={CheckCircle2} tone={won ? "success" : "neutral"} />
          <StatCard label="Unassigned" value={filtered.filter((l) => !l.ownerId).length} hint="Need an owner" icon={UserX} tone={filtered.some((l) => !l.ownerId) ? "warning" : "neutral"} />
        </div>
      </PageHeader>

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(l) => l.id}
        searchAccessor={(l) => `${l.name} ${l.company ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`}
        searchPlaceholder="Search by name, company or contact…"
        onRowClick={(l) => navigate(`/crm/leads/${l.id}`)}
        toolbar={
          <Select value={stage} onValueChange={(v) => setStage(v as LeadStage | "all")}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stageOptions.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        empty={{
          title: "No leads yet",
          description: "Add a lead to start tracking it through your pipeline.",
          action: <Button onClick={add}>New lead</Button>,
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={form.name} onChange={(e)=> setForm({ ...form, name: e.target.value })} placeholder="e.g., John Doe" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Company</label>
              <Input value={form.company} onChange={(e)=> setForm({ ...form, company: e.target.value })} placeholder="e.g., Acme Inc." />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Address</label>
              <Input value={form.address} onChange={(e)=> setForm({ ...form, address: e.target.value })} placeholder="Street, City, Country" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={form.email} onChange={(e)=> setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={form.phone} onChange={(e)=> setForm({ ...form, phone: e.target.value })} placeholder="+1 555 ..." />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Source</label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as 'website'|'referral'|'campaign'|'manual' })}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Owner</label>
              <Select value={form.ownerId} onValueChange={(v)=> setForm({ ...form, ownerId: v })}>
                <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
                <SelectContent>
                  {staff.map(u=> <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <UIButton variant="secondary" onClick={()=> setOpen(false)}>Cancel</UIButton>
            <UIButton onClick={save} disabled={!form.name.trim() && !form.company.trim()}>Create Lead</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;

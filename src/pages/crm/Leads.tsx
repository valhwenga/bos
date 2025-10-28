import { useMemo, useState } from "react";
import { CrmLeadsStore, type Lead, type LeadStage } from "@/lib/crmLeadsStore";
import { UsersStore } from "@/lib/usersStore";
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
  const navigate = useNavigate();
  const [list, setList] = useState(CrmLeadsStore.list());
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<LeadStage | 'all'>('all');
  const users = UsersStore.list();
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
    CrmLeadsStore.upsert(l);
    setList(CrmLeadsStore.list());
    setOpen(false);
    setForm({ name: "", company: "", email: "", phone: "", address: "", source: 'manual', ownerId: users[0]?.id||"" });
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="shadow-[0_10px_0_rgba(0,0,0,0.08)]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Leads</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Search" value={q} onChange={(e)=> setQ(e.target.value)} />
            <Select value={stage} onValueChange={(v)=> setStage(v as any)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stageOptions.map(s=> <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={add}>New Lead</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>{l.company||'-'}</TableCell>
                    <TableCell>{l.email||l.phone||'-'}</TableCell>
                    <TableCell className="capitalize">{l.stage.replace('_',' ')}</TableCell>
                    <TableCell>{users.find(u=>u.id===l.ownerId)?.name || '-'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={()=> navigate(`/crm/leads/${l.id}`)}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
              <Select value={form.source} onValueChange={(v)=> setForm({ ...form, source: v as any })}>
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
                  {users.map(u=> <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
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

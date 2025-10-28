import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CrmLeadsStore, type Lead, type LeadActivity, type LeadAttachment, type LeadStage } from "@/lib/crmLeadsStore";
import { UsersStore } from "@/lib/usersStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomersStore } from "@/lib/customersStore";
import { CrmDealsStore } from "@/lib/crmDealsStore";
import { canAccess } from "@/lib/accessControl";

const stageOptions: { key: LeadStage; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'proposal_sent', label: 'Proposal Sent' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | undefined>(undefined);
  const [activity, setActivity] = useState("");
  const users = UsersStore.list();
  const me = users[0]?.id;

  const refresh = () => setLead(id ? CrmLeadsStore.get(id) : undefined);
  useEffect(()=>{ refresh(); }, [id]);
  if (!lead) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
      <div className="mt-4">Lead not found</div>
    </div>
  );

  const update = (patch: Partial<Lead>) => {
    const before = lead;
    const next = { ...lead, ...patch } as Lead;
    CrmLeadsStore.upsert(next);
    setLead(next);
    // Automation: when moved to won, auto-create customer and deal (if not already)
    if (before?.stage !== 'won' && next.stage === 'won') {
      try {
        // Create customer if not exists by email/company name
        const existing = CustomersStore.list().find(c => (next.email && c.email && c.email.toLowerCase()===next.email.toLowerCase()) || (next.company && c.name.toLowerCase()===next.company.toLowerCase()));
        const cust = existing || CustomersStore.upsert({ id: existing?.id || `c_${Date.now()}`, name: next.company || next.name, email: next.email, address: next.address, phone: next.phone });
        // Create a deal as Closed Won for traceability
        CrmDealsStore.upsert({ id: `D_${Date.now()}`, title: `${next.company || next.name} - Won`, customerId: cust.id, leadId: next.id, value: 0, probability: 100, expectedClose: new Date().toISOString(), stage: 'closed_won', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      } catch {}
    }
  };

  const addActivity = (type: LeadActivity['type']) => {
    if (!activity.trim() || !me) return;
    CrmLeadsStore.addActivity(lead.id, { id: Math.random().toString(36).slice(2), ts: new Date().toISOString(), type, text: activity, authorId: me });
    setActivity(""); refresh();
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files||[]);
    const toDataUrl = (file: File): Promise<LeadAttachment> => new Promise((resolve)=>{
      const reader = new FileReader(); reader.onload = ()=> resolve({ id: Math.random().toString(36).slice(2), name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) }); reader.readAsDataURL(file);
    });
    const atts = await Promise.all(fs.map(toDataUrl));
    for (const a of atts) CrmLeadsStore.addAttachment(lead.id, a);
    refresh();
  };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Lead Detail</CardTitle>
          <div className="flex items-center gap-2">
            {canAccess('crm','full') && (
              <Button variant="destructive" onClick={()=> { CrmLeadsStore.remove(lead.id); navigate(-1); }}>Delete</Button>
            )}
            <Button variant="secondary" onClick={()=> navigate(-1)}>Back</Button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={()=> navigate(-1)}>Close</Button>
            <Button onClick={()=> { const c = CustomersStore.upsert({ id: `c_${Date.now()}`, name: lead.company || lead.name, email: lead.email, address: lead.address, phone: lead.phone }); update({ stage: 'won' }); }}>Convert to Customer</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={lead.name} onChange={(e)=> update({ name: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Company</label>
              <Input value={lead.company||""} onChange={(e)=> update({ company: e.target.value })} />
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Address</label>
              <Input value={lead.address||""} onChange={(e)=> update({ address: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={lead.email||""} onChange={(e)=> update({ email: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={lead.phone||""} onChange={(e)=> update({ phone: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Stage</label>
              <Select value={lead.stage} onValueChange={(v)=> update({ stage: v as LeadStage })}>
                <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  {stageOptions.map(s=> <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Owner</label>
              <Select value={lead.ownerId ?? 'unassigned'} onValueChange={(v)=> update({ ownerId: v === 'unassigned' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map(u=> <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-4">
            <div>
              <div className="font-medium mb-2">Activity & Notes</div>
              <div className="space-y-2 max-h-72 overflow-auto border rounded p-2">
                {lead.activities.map(a => (
                  <div key={a.id} className="text-sm border-b last:border-b-0 pb-2">
                    <div className="text-xs text-muted-foreground">{new Date(a.ts).toLocaleString()} • {a.type} • {users.find(u=>u.id===a.authorId)?.name||a.authorId}</div>
                    <div>{a.text}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input placeholder="Add a note..." value={activity} onChange={(e)=> setActivity(e.target.value)} />
                <Button size="sm" onClick={()=> addActivity('note')}>Add</Button>
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Attachments</div>
              <div className="flex flex-wrap gap-3">
                {lead.attachments.map(a => (
                  a.type.startsWith('image/') ? (
                    <a key={a.id} href={a.dataUrl} target="_blank" className="block"><img src={a.dataUrl} className="h-24 w-24 object-cover rounded border" /></a>
                  ) : (
                    <a key={a.id} href={a.dataUrl} target="_blank" className="text-sm underline">{a.name}</a>
                  )
                ))}
              </div>
              <div className="mt-2">
                <Input type="file" multiple onChange={onFiles} />
              </div>
              <div className="mt-6">
                <div className="font-medium mb-2">Custom Fields</div>
                <div className="space-y-2">
                  {Object.entries(lead.custom||{}).map(([k,v]) => (
                    <div key={k} className="grid grid-cols-2 gap-2">
                      <Input value={k} disabled className="bg-muted/40" />
                      <Input value={v} onChange={(e)=> update({ custom: { ...(lead.custom||{}), [k]: e.target.value } })} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Field name (e.g., Industry)" onKeyDown={(e)=> {
                      const target = e.target as HTMLInputElement; if (e.key==='Enter' && target.value.trim()) { update({ custom: { ...(lead.custom||{}), [target.value.trim()]: '' } }); target.value=''; }
                    }} />
                    <div className="text-xs text-muted-foreground flex items-center">Press Enter to add a new field</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadDetail;

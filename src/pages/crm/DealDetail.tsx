import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CrmDealsStore, type Deal, type DealStage, type DealComment } from "@/lib/crmDealsStore";
import { UsersStore } from "@/lib/usersStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canAccess } from "@/lib/accessControl";

const STAGES: { key: DealStage; title: string }[] = [
  { key: 'negotiation', title: 'Negotiation' },
  { key: 'proposal', title: 'Proposal' },
  { key: 'review', title: 'Review' },
  { key: 'closed_won', title: 'Closed Won' },
  { key: 'closed_lost', title: 'Closed Lost' },
];

const DealDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const users = UsersStore.list();
  const me = users[0]?.id || "me";
  const [d, setD] = useState<Deal | undefined>(undefined);
  const [note, setNote] = useState("");

  const refresh = () => setD(id ? CrmDealsStore.get(id) : undefined);
  useEffect(()=> { refresh(); }, [id]);

  if (!d) return (
    <div className="p-6">
      <Button variant="secondary" onClick={()=> nav(-1)}>Back</Button>
      <div className="mt-4">Deal not found</div>
    </div>
  );

  const update = (patch: Partial<Deal>) => { const next = { ...d, ...patch, updatedAt: new Date().toISOString() } as Deal; CrmDealsStore.upsert(next); setD(next); };
  const addComment = () => { if (!note.trim()) return; CrmDealsStore.addComment(d.id, { id: Math.random().toString(36).slice(2), ts: new Date().toISOString(), authorId: me, text: note }); setNote(""); refresh(); };

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Deal Detail</CardTitle>
          <div className="flex items-center gap-2">
            {canAccess('crm','full') && (
              <Button variant="destructive" onClick={()=> { CrmDealsStore.remove(d.id); nav(-1); }}>Delete</Button>
            )}
            <Button variant="secondary" onClick={()=> nav(-1)}>Back</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={d.title} onChange={(e)=> update({ title: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Value</label>
              <Input type="number" value={d.value} onChange={(e)=> update({ value: parseFloat(e.target.value||"0") })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Probability %</label>
              <Input type="number" value={d.probability} onChange={(e)=> update({ probability: parseFloat(e.target.value||"0") })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Expected Close</label>
              <Input type="date" value={(d.expectedClose||"").slice(0,10)} onChange={(e)=> update({ expectedClose: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Stage</label>
              <Select value={d.stage} onValueChange={(v)=> update({ stage: v as DealStage })}>
                <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s=> <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Owner</label>
              <Select value={d.ownerId ?? 'unassigned'} onValueChange={(v)=> update({ ownerId: v === 'unassigned' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Assign" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map(u=> <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="font-medium mb-2">Comments</div>
            <div className="space-y-2 max-h-72 overflow-auto border rounded p-2">
              {(d.comments||[]).map(c => (
                <div key={c.id} className="text-sm border-b last:border-b-0 pb-2">
                  <div className="text-xs text-muted-foreground">{new Date(c.ts).toLocaleString()} • {users.find(u=>u.id===c.authorId)?.name||c.authorId}</div>
                  <div>{c.text}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input placeholder="Add comment..." value={note} onChange={(e)=> setNote(e.target.value)} onKeyDown={(e)=> { if(e.key==='Enter'){ addComment(); } }} />
              <Button size="sm" onClick={addComment}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DealDetail;

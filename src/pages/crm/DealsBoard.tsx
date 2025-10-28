import { useEffect, useMemo, useState } from "react";
import { CrmDealsStore, type Deal, type DealStage } from "@/lib/crmDealsStore";
import { UsersStore } from "@/lib/usersStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const STAGES: { key: DealStage; title: string }[] = [
  { key: 'negotiation', title: 'Negotiation' },
  { key: 'proposal', title: 'Proposal' },
  { key: 'review', title: 'Review' },
  { key: 'closed_won', title: 'Closed Won' },
  { key: 'closed_lost', title: 'Closed Lost' },
];

const DealsBoard = () => {
  const [deals, setDeals] = useState(CrmDealsStore.list());
  const navigate = useNavigate();
  const users = UsersStore.list();

  const grouped = useMemo(() => {
    const m: Record<DealStage, Deal[]> = { negotiation: [], proposal: [], review: [], closed_won: [], closed_lost: [] };
    for (const d of deals) m[d.stage].push(d);
    return m;
  }, [deals]);

  const add = () => {
    const d: Deal = { id: `D_${Date.now()}`, title: 'New Deal', stage: 'negotiation', value: 0, probability: 10, createdAt: new Date().toISOString() };
    CrmDealsStore.upsert(d); setDeals(CrmDealsStore.list());
  };

  const onDropCard = (dealId: string, toStage: DealStage) => {
    CrmDealsStore.move(dealId, toStage); setDeals(CrmDealsStore.list());
  };

  let dragMeta: { id?: string; startX?: number; startY?: number } = {};
  const onPointerDown = (e: React.PointerEvent, d: Deal) => {
    dragMeta = { id: d.id, startX: e.clientX, startY: e.clientY };
  };
  const onDragStart = (e: React.DragEvent, d: Deal) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: d.id }));
  };
  const onCardClick = (e: React.MouseEvent, d: Deal) => {
    const dx = Math.abs((dragMeta.startX||0) - e.clientX);
    const dy = Math.abs((dragMeta.startY||0) - e.clientY);
    if (dx < 5 && dy < 5) navigate(`/crm/deals/${d.id}`);
  };

  const allowDrop = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    try { const data = JSON.parse(e.dataTransfer.getData('text/plain')); if (data?.id) onDropCard(data.id, stage); } catch {}
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">Deals</div>
        <Button onClick={add}>New Deal</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {STAGES.map(col => (
          <div key={col.key} className="min-h-[60vh] border rounded bg-muted/40" onDragOver={allowDrop} onDrop={(e)=> onDrop(e, col.key)}>
            <div className="px-3 py-2 text-sm font-medium border-b bg-card sticky top-0">{col.title}</div>
            <div className="p-2 space-y-2">
              {grouped[col.key].map(d => (
                <Card key={d.id} draggable onPointerDown={(e)=> onPointerDown(e, d)} onDragStart={(e)=> onDragStart(e, d)} onClick={(e)=> onCardClick(e, d)} className="p-3 cursor-pointer select-none">
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="text-xs text-muted-foreground">Value: ${d.value.toFixed(2)} • Prob: {d.probability}%</div>
                  {d.expectedClose && <div className="text-[11px] text-muted-foreground">Expected: {new Date(d.expectedClose).toLocaleDateString()}</div>}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DealsBoard;

export type DealStage = 'negotiation' | 'proposal' | 'review' | 'closed_won' | 'closed_lost';
export type DealComment = { id: string; ts: string; authorId: string; text: string };
export type Deal = {
  id: string;
  title: string;
  customerId?: string; // link to CRM customer
  leadId?: string; // alternatively source lead
  value: number;
  probability: number; // 0-100
  expectedClose?: string; // ISO date
  stage: DealStage;
  ownerId?: string;
  createdAt: string;
  updatedAt?: string;
  comments?: DealComment[];
};

const K = { deals: 'crm.deals' };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Deal[] = [
  { id: 'D001', title: 'Website Revamp', value: 8500, probability: 40, stage: 'negotiation', ownerId: undefined, createdAt: new Date().toISOString() },
];

export const CrmDealsStore = {
  list(): Deal[] { return r<Deal[]>(K.deals, SEED); },
  upsert(d: Deal) { const all = this.list(); const i = all.findIndex(x=> x.id===d.id); if (i>=0) all[i]=d; else all.unshift(d); w(K.deals, all); return d; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.deals, all); },
  get(id: string) { return this.list().find(x=> x.id===id); },
  move(id: string, stage: DealStage) { const d = this.get(id); if(!d) return; d.stage = stage; d.updatedAt = new Date().toISOString(); this.upsert(d); },
  addComment(id: string, c: DealComment) { const d = this.get(id); if(!d) return; d.comments = [...(d.comments||[]), c]; this.upsert(d); return c; },
};

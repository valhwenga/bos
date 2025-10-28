export type LeadActivity = { id: string; ts: string; type: 'note' | 'call' | 'meeting'; text: string; authorId: string };
export type LeadAttachment = { id: string; name: string; type: string; size: number; dataUrl: string };
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';
export type LeadSource = 'website' | 'referral' | 'campaign' | 'manual';
export type Lead = {
  id: string;
  name: string;
  company?: string;
  address?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  stage: LeadStage;
  ownerId?: string;
  notes?: string;
  custom?: Record<string, string>;
  activities: LeadActivity[];
  attachments: LeadAttachment[];
  createdAt: string;
};

const K = { leads: 'crm.leads' };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Lead[] = [
  { id: 'L001', name: 'Acme Procurement', company: 'Acme Inc.', email: 'buyer@acme.com', phone: '+1 555 100 2000', source: 'website', stage: 'new', ownerId: undefined, notes: 'Requested brochure', activities: [], attachments: [], createdAt: new Date().toISOString() },
];

export const CrmLeadsStore = {
  list(): Lead[] { return r<Lead[]>(K.leads, SEED); },
  upsert(l: Lead) { const all = this.list(); const i = all.findIndex(x=> x.id===l.id); if (i>=0) all[i]=l; else all.unshift(l); w(K.leads, all); return l; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.leads, all); },
  get(id: string) { return this.list().find(x=> x.id===id); },
  addActivity(id: string, a: LeadActivity) { const l = this.get(id); if(!l) return; l.activities = [...l.activities, a]; this.upsert(l); return a; },
  addAttachment(id: string, at: LeadAttachment) { const l = this.get(id); if(!l) return; l.attachments = [...l.attachments, at]; this.upsert(l); return at; },
};

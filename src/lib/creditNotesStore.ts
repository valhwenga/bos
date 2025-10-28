export type CreditApply = { invoiceId: string; amount: number };
export type CreditNote = {
  id: string;
  number: string;
  date: string; // ISO date YYYY-MM-DD
  customerId: string;
  customerName?: string;
  amount: number; // total credit amount
  applied?: CreditApply[]; // how it's applied to invoices
  notes?: string;
  createdAt: string;
};

const K = { credits: 'acct.credits' };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {} };

export const CreditNotesStore = {
  list(): CreditNote[] { return r<CreditNote[]>(K.credits, []); },
  upsert(cn: CreditNote) { const all = this.list(); const i = all.findIndex(x=> x.id===cn.id); if (i>=0) all[i]=cn; else all.unshift(cn); w(K.credits, all); emit('acct.credits-changed'); return cn; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.credits, all); emit('acct.credits-changed'); },
  get(id: string) { return this.list().find(x=> x.id===id); },
  sumAppliedToInvoice(invoiceId: string) { return this.list().reduce((s, cn)=> s + (cn.applied||[]).filter(a=> a.invoiceId===invoiceId).reduce((sa, a)=> sa + a.amount, 0), 0); },
};

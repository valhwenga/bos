export type SaleItem = { id: string; name: string; qty: number; price: number; description?: string };
export type Sale = {
  id: string;
  number: string;
  date: string; // ISO date YYYY-MM-DD
  customerId?: string;
  customerName?: string; // snapshot
  items: SaleItem[];
  method?: string;
  reference?: string;
  notes?: string;
  createdAt: string; // ISO
};

const K = { sales: "acct.sales" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {} };

export const SalesStore = {
  list(): Sale[] { return r<Sale[]>(K.sales, []); },
  upsert(s: Sale) { const all = this.list(); const i = all.findIndex(x=> x.id===s.id); if (i>=0) all[i]=s; else all.unshift(s); w(K.sales, all); emit('acct.sales-changed'); return s; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.sales, all); emit('acct.sales-changed'); },
  get(id: string) { return this.list().find(x=> x.id===id); },
};

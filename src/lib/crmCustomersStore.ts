export type ContactPerson = { id: string; name: string; email?: string; phone?: string; role?: string };
export type CrmCustomer = {
  id: string;
  name: string;
  address?: string;
  taxNumber?: string;
  logoDataUrl?: string;
  tags?: string[];
  custom?: Record<string, string>;
  contacts: ContactPerson[];
  createdAt: string;
};

const K = { customers: 'crm.customers' };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: CrmCustomer[] = [
  { id: 'C001', name: 'Acme Inc.', address: '100 Main St', taxNumber: 'TAX-123', contacts: [{ id: 'p1', name: 'Francisco Smith', email: 'francisco@acme.com', role: 'Manager' }], createdAt: new Date().toISOString() },
];

export const CrmCustomersStore = {
  list(): CrmCustomer[] { return r<CrmCustomer[]>(K.customers, SEED); },
  upsert(c: CrmCustomer) { const all = this.list(); const i = all.findIndex(x=> x.id===c.id); if (i>=0) all[i]=c; else all.unshift(c); w(K.customers, all); return c; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.customers, all); },
  get(id: string) { return this.list().find(x=> x.id===id); },
};

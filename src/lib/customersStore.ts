export type CustomerAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export type CustomerResponsible = {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
};

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  taxNumber?: string;
  billingAddress?: CustomerAddress;
  shippingAddress?: CustomerAddress;
  shippingSameAsBilling?: boolean;
  responsible?: CustomerResponsible;
  tags?: string[];
};

const K = { customers: "crm.customers" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Customer[] = [
  { id: "c_1", name: "Acme LLC", email: "contact@acme.com", companyName: "Acme LLC" },
  { id: "c_2", name: "Globex Corp", email: "ops@globex.com", companyName: "Globex Corp" },
  { id: "c_3", name: "Stark Industries", email: "pm@stark.com", companyName: "Stark Industries" },
];

export const CustomersStore = {
  list(): Customer[] { return r<Customer[]>(K.customers, SEED); },
  upsert(c: Customer) { const all = this.list(); const i = all.findIndex(x=>x.id===c.id); if(i>=0) all[i]=c; else all.push(c); w(K.customers, all); return c; },
  remove(id: string) { const all = this.list().filter(x=> x.id !== id); w(K.customers, all); },
};

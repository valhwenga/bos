export type ClientStatus = "active" | "inactive";

export type Client = {
  id: string;
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  status: ClientStatus;
  createdAt: string; // ISO
};

const K = { clients: "user.clients" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Client[] = [];

export const ClientsStore = {
  list(): Client[] { return r<Client[]>(K.clients, SEED); },
  upsert(c: Client) { const all = this.list(); const i = all.findIndex(x=> x.id===c.id); if(i>=0) all[i]=c; else all.push(c); w(K.clients, all); return c; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.clients, all); },
  get(id: string) { return this.list().find(x=> x.id===id); }
};

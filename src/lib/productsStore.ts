export type Product = { id: string; name: string; price: number; description?: string };

const K = { products: "acct.products" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Product[] = [
  { id: "p1", name: "Consulting Hour", price: 100, description: "Hourly consulting services" },
  { id: "p2", name: "Design Package", price: 750, description: "Branding and UI design package" },
  { id: "p3", name: "Hosting (Monthly)", price: 25, description: "Managed hosting per month" },
];

export const ProductsStore = {
  list(): Product[] { return r<Product[]>(K.products, SEED); },
  upsert(p: Product) { const all = this.list(); const i = all.findIndex(x=>x.id===p.id); if(i>=0) all[i]=p; else all.push(p); w(K.products, all); return p; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.products, all); },
};

/**
 * Cash sales. Rows in Postgres now.
 */

import { createCache } from "./collectionCache";
import { SaleRepo } from "./accountingRepo";

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

export const salesCache = createCache<Sale>(() => SaleRepo.list());

const announce = () => {
  try {
    window.dispatchEvent(new Event("acct.sales-changed"));
  } catch {
    void 0;
  }
};

export const SalesStore = {
  list(): Sale[] {
    return salesCache.list();
  },
  load(): Promise<Sale[]> {
    return salesCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(s: Sale): Promise<Sale> {
    await salesCache.mutate(() => SaleRepo.upsert(s));
    announce();
    return s;
  },
  async remove(id: string): Promise<void> {
    await salesCache.mutate(() => SaleRepo.remove(id));
    announce();
  },
};
/**
 * CRM customers: the relationship record and its contact people.
 *
 * Distinct from the accounting `customers` table, which is who an invoice is
 * billed to. Rows in Postgres now.
 */

import { createCache } from "./collectionCache";
import { CrmCustomerRepo } from "./crmRepo";

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

export const crmCustomersCache = createCache<CrmCustomer>(() => CrmCustomerRepo.list());

export const CrmCustomersStore = {
  list(): CrmCustomer[] {
    return crmCustomersCache.list();
  },
  load(): Promise<CrmCustomer[]> {
    return crmCustomersCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(c: CrmCustomer): Promise<CrmCustomer> {
    await crmCustomersCache.mutate(() => CrmCustomerRepo.upsert(c));
    return c;
  },
  async remove(id: string): Promise<void> {
    await crmCustomersCache.mutate(() => CrmCustomerRepo.remove(id));
  },
};
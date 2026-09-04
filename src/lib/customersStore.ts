/**
 * Customers.
 *
 * Rows in Postgres now. Previously a localStorage array seeded with three
 * fictional companies, which meant every browser started with Acme LLC and
 * whatever real customers had been added on that machine alone.
 */

import { createCache } from "./collectionCache";
import { CustomerRepo } from "./accountingRepo";

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

export const customersCache = createCache<Customer>(() => CustomerRepo.list());

export const CustomersStore = {
  list(): Customer[] {
    return customersCache.list();
  },
  load(): Promise<Customer[]> {
    return customersCache.ensureLoaded();
  },
  get(id: string): Customer | undefined {
    return customersCache.list().find((c) => c.id === id);
  },
  async upsert(c: Customer): Promise<Customer> {
    await customersCache.mutate(() => CustomerRepo.upsert(c));
    return c;
  },
  async remove(id: string): Promise<void> {
    await customersCache.mutate(() => CustomerRepo.remove(id));
  },
};
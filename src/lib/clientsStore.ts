/**
 * Clients. Rows in Postgres now; a client portal login points at one of these.
 */

import { createCache } from "./collectionCache";
import { ClientRepo } from "./supportRepo";

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

export const clientsCache = createCache<Client>(() => ClientRepo.list());

export const ClientsStore = {
  list(): Client[] {
    return clientsCache.list();
  },
  load(): Promise<Client[]> {
    return clientsCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((c) => c.id === id);
  },
  async upsert(c: Client): Promise<Client> {
    await clientsCache.mutate(() => ClientRepo.upsert(c));
    return c;
  },
  async remove(id: string): Promise<void> {
    await clientsCache.mutate(() => ClientRepo.remove(id));
  },
};
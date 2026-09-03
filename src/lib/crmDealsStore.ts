/**
 * Deals. Rows in Postgres now.
 */

import { createCache } from "./collectionCache";
import { DealRepo } from "./crmRepo";

export type DealStage = 'negotiation' | 'proposal' | 'review' | 'closed_won' | 'closed_lost';
export type DealComment = { id: string; ts: string; authorId: string; text: string };
export type Deal = {
  id: string;
  title: string;
  customerId?: string; // link to CRM customer
  leadId?: string; // alternatively source lead
  value: number;
  probability: number; // 0-100
  expectedClose?: string; // ISO date
  stage: DealStage;
  ownerId?: string;
  createdAt: string;
  updatedAt?: string;
  comments?: DealComment[];
};

export const dealsCache = createCache<Deal>(() => DealRepo.list());

export const CrmDealsStore = {
  list(): Deal[] {
    return dealsCache.list();
  },
  load(): Promise<Deal[]> {
    return dealsCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(d: Deal): Promise<Deal> {
    await dealsCache.mutate(() => DealRepo.upsert(d));
    return d;
  },
  async remove(id: string): Promise<void> {
    await dealsCache.mutate(() => DealRepo.remove(id));
  },
  async move(id: string, stage: DealStage): Promise<void> {
    const deal = this.get(id);
    if (!deal) return;
    await this.upsert({ ...deal, stage, updatedAt: new Date().toISOString() });
  },
  async addComment(id: string, c: DealComment): Promise<DealComment | undefined> {
    const deal = this.get(id);
    if (!deal) return undefined;
    await this.upsert({ ...deal, comments: [...(deal.comments ?? []), c] });
    return c;
  },
};
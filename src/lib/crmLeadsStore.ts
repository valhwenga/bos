/**
 * Leads. Rows in Postgres now — a pipeline only its creator could see is close
 * to useless for a sales tool.
 *
 * Attachments are files in the lead-attachments bucket rather than base64 on
 * the record.
 */

import { createCache } from "./collectionCache";
import { LeadRepo } from "./crmRepo";

export type LeadActivity = { id: string; ts: string; type: 'note' | 'call' | 'meeting'; text: string; authorId: string };
export type LeadAttachment = { id: string; name: string; type: string; size: number; dataUrl: string };
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';
export type LeadSource = 'website' | 'referral' | 'campaign' | 'manual';
export type Lead = {
  id: string;
  name: string;
  company?: string;
  address?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  stage: LeadStage;
  ownerId?: string;
  notes?: string;
  custom?: Record<string, string>;
  activities: LeadActivity[];
  attachments: LeadAttachment[];
  createdAt: string;
};

export const leadsCache = createCache<Lead>(() => LeadRepo.list());

export const CrmLeadsStore = {
  list(): Lead[] {
    return leadsCache.list();
  },
  load(): Promise<Lead[]> {
    return leadsCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(l: Lead): Promise<Lead> {
    await leadsCache.mutate(() => LeadRepo.upsert(l));
    return l;
  },
  async remove(id: string): Promise<void> {
    await leadsCache.mutate(() => LeadRepo.remove(id));
  },
  async addActivity(id: string, a: LeadActivity): Promise<LeadActivity | undefined> {
    const lead = this.get(id);
    if (!lead) return undefined;
    await this.upsert({ ...lead, activities: [...(lead.activities ?? []), a] });
    return a;
  },
};
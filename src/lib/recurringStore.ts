/**
 * Recurring invoice templates. Rows in Postgres now.
 *
 * This matters more than most: the scheduler bills from these, and a template
 * that lived in one person's browser billed only while that browser was open.
 * The authoritative schedule is generate_due_recurring_invoices() in Postgres.
 */

import { createCache } from "./collectionCache";
import { RecurringRepo } from "./accountingRepo";

import type { Customer, LineItem } from "@/lib/accountingStore";

export type RecurringCadence = "weekly" | "monthly" | "quarterly" | "yearly" | "customDays";
export type RecurringTemplate = {
  id: string;
  name: string;
  customer: Customer;
  items: LineItem[];
  cadence: RecurringCadence;
  intervalDays?: number; // for customDays
  startDate: string; // ISO date YYYY-MM-DD
  endDate?: string; // ISO date
  timeOfDay: string; // HH:MM (24h)
  nextRunAt: string; // ISO datetime
  active: boolean;
  autoSend: boolean;
  notes?: string;
  createdAt: string;
  lastRunAt?: string;
  seqPrefix?: string;
  nextNumber?: number;
};

export const recurringCache = createCache<RecurringTemplate>(() => RecurringRepo.list());

const announce = () => {
  try {
    window.dispatchEvent(new Event("acct.recurring-changed"));
  } catch {
    void 0;
  }
};

export const RecurringStore = {
  list(): RecurringTemplate[] {
    return recurringCache.list();
  },
  load(): Promise<RecurringTemplate[]> {
    return recurringCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(t: RecurringTemplate): Promise<RecurringTemplate> {
    await recurringCache.mutate(() => RecurringRepo.upsert(t));
    announce();
    return t;
  },
  async remove(id: string): Promise<void> {
    await recurringCache.mutate(() => RecurringRepo.remove(id));
    announce();
  },
  computeNextRun(prev: RecurringTemplate): string {
    const cur = new Date(prev.nextRunAt || (prev.startDate + 'T' + (prev.timeOfDay||'09:00') + ':00'));
    const next = new Date(cur.getTime());
    switch (prev.cadence) {
      case 'weekly': next.setDate(next.getDate() + 7); break;
      case 'monthly': next.setMonth(next.getMonth() + 1); break;
      case 'quarterly': next.setMonth(next.getMonth() + 3); break;
      case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
      case 'customDays': default: next.setDate(next.getDate() + (prev.intervalDays || 30)); break;
    }
    return next.toISOString();
  },
};

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

const K = { rec: "acct.recurring" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {} };

export const RecurringStore = {
  list(): RecurringTemplate[] { return r<RecurringTemplate[]>(K.rec, []); },
  upsert(t: RecurringTemplate) { const all = this.list(); const i = all.findIndex(x=> x.id===t.id); if (i>=0) all[i]=t; else all.unshift(t); w(K.rec, all); emit('acct.recurring-changed'); return t; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.rec, all); emit('acct.recurring-changed'); },
  get(id: string) { return this.list().find(x=> x.id===id); },
  computeNextRun(prev: RecurringTemplate): string {
    const cur = new Date(prev.nextRunAt || (prev.startDate + 'T' + (prev.timeOfDay||'09:00') + ':00'));
    let next = new Date(cur.getTime());
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

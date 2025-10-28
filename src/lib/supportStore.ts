export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "pending_approval" | "closed" | "rejected";
export type Priority = "low" | "medium" | "high" | "urgent";

export type Attachment = { id: string; name: string; type: string; size: number; dataUrl: string };
export type Comment = { id: string; author: string; ts: string; message: string; attachments?: Attachment[] };

export type Ticket = {
  id: string;
  title: string;
  description: string;
  requester: string; // user id or email
  departmentId?: string;
  assigneeId?: string;
  category?: string;
  priority: Priority;
  status: TicketStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  firstResponseAt?: string; // ISO
  resolvedAt?: string; // ISO
  dueAt?: string; // ISO SLA target
  comments: Comment[];
  attachments?: Attachment[];
  closureRequest?: {
    requestedBy: string;
    requestedAt: string;
    note?: string;
  } | null;
  approval?: {
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    reason?: string;
  } | null;
};

export type SupportSettings = {
  categories: string[];
  slaTargets: {
    low: number; // hours
    medium: number;
    high: number;
    urgent: number;
  };
};

export type CannedResponse = { id: string; title: string; body: string };

const K = { tickets: "support.tickets", settings: "support.settings", canned: "support.canned" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Ticket[] = [];
const DEFAULT_SETTINGS: SupportSettings = { categories: ["General", "Billing", "Technical", "Access"], slaTargets: { low: 72, medium: 48, high: 24, urgent: 8 } };
const DEFAULT_CANNED: CannedResponse[] = [
  { id: "cr1", title: "Acknowledged", body: "Thanks for reaching out. We have received your ticket and are investigating." },
  { id: "cr2", title: "Need More Info", body: "Could you please provide more details and any relevant screenshots to help us diagnose?" },
  { id: "cr3", title: "Resolved", body: "We believe this issue is resolved. Please verify on your end and let us know if anything remains." },
];

export const SupportStore = {
  list(): Ticket[] { return r<Ticket[]>(K.tickets, SEED); },
  get(id: string): Ticket | undefined { return this.list().find(t => t.id === id); },
  upsert(t: Ticket) { const all = this.list(); const i = all.findIndex(x=> x.id===t.id); if(i>=0) all[i]=t; else all.unshift(t); w(K.tickets, all); return t; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.tickets, all); },
  settings(): SupportSettings { return r<SupportSettings>(K.settings, DEFAULT_SETTINGS); },
  setSettings(s: SupportSettings) { w(K.settings, s); return s; },
  canned(): CannedResponse[] { return r<CannedResponse[]>(K.canned, DEFAULT_CANNED); },
  setCanned(list: CannedResponse[]) { w(K.canned, list); return list; },
};

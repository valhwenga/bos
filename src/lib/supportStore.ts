/**
 * Support tickets, settings and canned responses.
 *
 * Rows in Postgres now. A per-browser support queue means an agent cannot see
 * what a colleague has already answered, and a customer's ticket exists only on
 * whichever machine took it.
 *
 * SLA targets matter for the same reason: with per-machine settings, two people
 * could disagree about whether the same ticket had breached.
 */

import { createCache } from "./collectionCache";
import { CannedResponseRepo, SupportSettingsRepo, TicketRepo } from "./supportRepo";

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "pending_approval" | "closed" | "rejected";
export type Priority = "low" | "medium" | "high" | "urgent";

export type Attachment = { id: string; name: string; type: string; size: number; dataUrl: string };
export type Comment = { id: string; author: string; ts: string; message: string; attachments?: Attachment[] };

export type Ticket = {
  id: string;
  /** Short public reference, e.g. T-00042. Goes in the subject of ticket mail
   *  so a customer's reply threads onto the same ticket. */
  reference?: string;
  title: string;
  description: string;
  clientId?: string;
  requester: string; // user id or email
  /** Set when the ticket arrived by email, so a reply can go back out. */
  requesterEmail?: string;
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

/** Used only until the settings row loads, so the SLA figures are never NaN. */
const DEFAULT_SETTINGS: SupportSettings = {
  categories: ["General", "Billing", "Technical", "Access"],
  slaTargets: { low: 72, medium: 48, high: 24, urgent: 8 },
};

export const ticketsCache = createCache<Ticket>(() => TicketRepo.list());
export const supportSettingsCache = createCache<SupportSettings>(async () => [
  await SupportSettingsRepo.get(),
]);
export const cannedResponsesCache = createCache<CannedResponse>(() => CannedResponseRepo.list());

export const SupportStore = {
  list(): Ticket[] {
    return ticketsCache.list();
  },
  get(id: string): Ticket | undefined {
    return this.list().find((t) => t.id === id);
  },
  async load(): Promise<void> {
    await Promise.all([
      ticketsCache.ensureLoaded(),
      supportSettingsCache.ensureLoaded(),
      cannedResponsesCache.ensureLoaded(),
    ]);
  },
  async upsert(t: Ticket): Promise<Ticket> {
    await ticketsCache.mutate(() => TicketRepo.upsert(t));
    return t;
  },
  async remove(id: string): Promise<void> {
    await ticketsCache.mutate(() => TicketRepo.remove(id));
  },

  settings(): SupportSettings {
    return supportSettingsCache.list()[0] ?? DEFAULT_SETTINGS;
  },
  async setSettings(s: SupportSettings): Promise<SupportSettings> {
    await supportSettingsCache.mutate(() => SupportSettingsRepo.update(s));
    return s;
  },

  canned(): CannedResponse[] {
    return cannedResponsesCache.list();
  },
  async setCanned(list: CannedResponse[]): Promise<CannedResponse[]> {
    await cannedResponsesCache.mutate(() => CannedResponseRepo.replaceAll(list));
    return list;
  },
};
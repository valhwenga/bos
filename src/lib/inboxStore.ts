/**
 * Received mail.
 *
 * Rows written by the receive-email function, which a mail provider posts to.
 * Nothing here is writable from the browser except whether a message has been
 * read or archived — the contents are evidence of what somebody sent, and a
 * mailbox you can edit is not a record of anything.
 *
 * Every field came from a stranger. The screens render it as text, never
 * markup, and show what the provider made of the sender's claim to be who they
 * say rather than presenting an unverified address as though it were checked.
 */

import { supabase } from "./supabase";
import { createCache } from "./collectionCache";

export type InboundAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
};

export type InboundEmail = {
  id: string;
  fromAddress: string;
  fromName?: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  spf?: string;
  dkim?: string;
  spamScore?: number;
  receivedAt: string;
  read: boolean;
  archived: boolean;
  attachments: InboundAttachment[];
};

const COLUMNS =
  "id, from_address, from_name, to_addresses, cc_addresses, subject, body, spf, dkim, spam_score, received_at, read_at, archived_at";

/**
 * Whether the sender is who they say they are, as far as anyone can tell.
 *
 * "pass" is the only reassuring answer. A missing result is not a failure — a
 * great deal of legitimate mail has no DKIM signature — but it is not a pass
 * either, and the difference is worth showing rather than flattening.
 */
export type SenderCheck = "passed" | "failed" | "unchecked";

export function senderCheck(email: InboundEmail): SenderCheck {
  const results = [email.spf, email.dkim].filter(Boolean).map((r) => r!.toLowerCase());
  if (results.length === 0) return "unchecked";
  if (results.some((r) => r.includes("fail") || r.includes("softfail"))) return "failed";
  if (results.some((r) => r.includes("pass"))) return "passed";
  return "unchecked";
}

async function fetchInbox(): Promise<InboundEmail[]> {
  const { data, error } = await supabase
    .from("inbound_emails")
    .select(COLUMNS)
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const attachments = await attachmentsFor(rows.map((r) => r.id as string));

  return rows.map((row) => ({
    id: row.id as string,
    fromAddress: (row.from_address as string) ?? "",
    fromName: (row.from_name as string) ?? undefined,
    to: (row.to_addresses as string[]) ?? [],
    cc: (row.cc_addresses as string[]) ?? [],
    subject: (row.subject as string) ?? "",
    body: (row.body as string) ?? "",
    spf: (row.spf as string) ?? undefined,
    dkim: (row.dkim as string) ?? undefined,
    spamScore: row.spam_score == null ? undefined : Number(row.spam_score),
    receivedAt: row.received_at as string,
    read: row.read_at !== null,
    archived: row.archived_at !== null,
    attachments: attachments.get(row.id as string) ?? [],
  }));
}

async function attachmentsFor(emailIds: string[]): Promise<Map<string, InboundAttachment[]>> {
  const out = new Map<string, InboundAttachment[]>();
  if (emailIds.length === 0) return out;

  const { data, error } = await supabase
    .from("inbound_email_attachments")
    .select("id, email_id, storage_path, file_name, mime_type, size_bytes")
    .in("email_id", emailIds);
  if (error) return out;

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    // Signed on demand and short lived. The bucket is private, and a URL that
    // never expires is a way around the permission check the moment it is
    // forwarded to somebody.
    const { data: signed } = await supabase.storage
      .from("inbound-email-attachments")
      .createSignedUrl(row.storage_path as string, 60 * 60);
    const emailId = row.email_id as string;
    out.set(emailId, [
      ...(out.get(emailId) ?? []),
      {
        id: row.id as string,
        name: row.file_name as string,
        type: (row.mime_type as string) ?? "application/octet-stream",
        size: Number(row.size_bytes ?? 0),
        url: signed?.signedUrl,
      },
    ]);
  }
  return out;
}

export const inboxCache = createCache<InboundEmail>(fetchInbox);

export const InboxStore = {
  list(): InboundEmail[] {
    return inboxCache.list();
  },
  /** What the inbox shows: everything not filed away. */
  active(): InboundEmail[] {
    return this.list().filter((m) => !m.archived);
  },
  unreadCount(): number {
    return this.active().filter((m) => !m.read).length;
  },
  get(id: string): InboundEmail | undefined {
    return this.list().find((m) => m.id === id);
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("inbound_emails")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    await inboxCache.refresh();
  },

  async setArchived(id: string, archived: boolean): Promise<void> {
    const { error } = await supabase
      .from("inbound_emails")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await inboxCache.refresh();
  },
};

/**
 * Subscribes to mail arriving.
 *
 * Unique topic per subscriber: Supabase returns the existing channel for a
 * repeated topic, and a second `.on()` after `subscribe()` throws.
 */
export function subscribeToInbox(onArrive?: () => void): () => void {
  const channel = supabase
    .channel(`inbound_emails:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "inbound_emails" },
      () => {
        void inboxCache.refresh();
        onArrive?.();
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

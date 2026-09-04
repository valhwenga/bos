/**
 * Outgoing mail, and the record of it.
 *
 * `send()` used to be a simulation. Its own comment said so — "Simulate send:
 * store to sent" — and it wrote a row to localStorage and returned. Compose had
 * since been wired to the real sender, but the two recurring-invoice paths had
 * not: they generated an invoice, called this, and then advanced the billing
 * schedule. The period was marked billed, the customer was never emailed, and
 * nothing reported a failure because nothing had been attempted.
 *
 * It sends now. The record lives in Postgres, written by the send-email
 * function rather than by the browser, because only the function knows whether
 * the mail server accepted the message.
 *
 * There is no inbox. Receiving mail needs IMAP polling or an inbound webhook,
 * and neither exists — so the folder could only ever have been empty, which is
 * why it is gone rather than merely unread.
 */

import { supabase } from "./supabase";
import { createCache } from "./collectionCache";
import { sendEmail } from "./sendDocument";

export type MailAddress = { name?: string; email: string };
export type MailAttachment = { id: string; name: string; type: string; size: number; dataUrl: string };

export type MailMessage = {
  id: string;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  body: string;
  date: string;
  sentByName?: string;
  attachmentNames: string[];
  module?: string;
  status: "sent" | "failed";
  error?: string;
};

const K = { smtp: "email.smtp", messages: "email.messages" };

const asAddresses = (list: string[] | null): MailAddress[] =>
  (list ?? []).map((email) => ({ email }));

async function fetchSent(): Promise<MailMessage[]> {
  const { data, error } = await supabase
    .from("email_messages")
    .select(
      "id, sent_by_name, to_addresses, cc_addresses, subject, body, attachment_names, module, status, error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    to: asAddresses(row.to_addresses as string[]),
    cc: asAddresses(row.cc_addresses as string[]),
    subject: (row.subject as string) ?? "",
    body: (row.body as string) ?? "",
    date: row.created_at as string,
    sentByName: (row.sent_by_name as string) ?? undefined,
    attachmentNames: (row.attachment_names as string[]) ?? [],
    module: (row.module as string) ?? undefined,
    status: (row.status as MailMessage["status"]) ?? "sent",
    error: (row.error as string) ?? undefined,
  }));
}

export const sentMailCache = createCache<MailMessage>(fetchSent);

export const EmailStore = {
  list(): MailMessage[] {
    return sentMailCache.list();
  },
  load(): Promise<MailMessage[]> {
    return sentMailCache.ensureLoaded();
  },
  get(id: string): MailMessage | undefined {
    return this.list().find((m) => m.id === id);
  },

  /**
   * Sends an email and records it.
   *
   * Throws if the mail server refused. Callers that must not be undone by a
   * failed send — a recurring invoice that has already been generated — should
   * catch it and carry on, rather than leaving the schedule where it was and
   * billing the period twice on the next run.
   */
  async send(message: {
    to: MailAddress[];
    cc?: MailAddress[];
    subject: string;
    body: string;
    attachments?: { filename: string; contentBase64: string; contentType?: string }[];
    module?: string;
  }): Promise<void> {
    const recipients = [...message.to, ...(message.cc ?? [])]
      .map((a) => a.email.trim())
      .filter(Boolean);
    if (recipients.length === 0) throw new Error("No recipient.");

    await sendEmail({
      to: recipients,
      subject: message.subject,
      body: message.body,
      attachments: message.attachments,
      module: message.module ?? "email",
    });

    // The function writes the row; this makes it visible without a reload.
    void sentMailCache.refresh();
  },

  /**
   * SMTP settings are not kept here, and never were read from here even when
   * they were. They sat in localStorage with the password in plain text, and
   * nothing sent anything with them. Credentials belong to the send-email
   * function's environment.
   *
   * Anything a previous version stored is cleared on load, along with the old
   * simulated mailbox, so neither lingers in a browser.
   */
  clearLegacyLocalMail() {
    try {
      localStorage.removeItem(K.smtp);
      localStorage.removeItem(K.messages);
    } catch {
      void 0;
    }
  },
};

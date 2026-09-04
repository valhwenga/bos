/**
 * Receives inbound email from a mail provider and files it.
 *
 * The app could send but not receive. A provider (SendGrid Inbound Parse,
 * Mailgun Routes, Postmark inbound) takes delivery for the domain and POSTs
 * each message here.
 *
 * This is the only endpoint in the system a stranger can reach. Everything it
 * receives is attacker-controlled — the from address most of all, which is as
 * forgeable as the return address on an envelope. So:
 *
 *   - The caller proves it is the provider with a shared secret, compared in
 *     constant time. Without that, anyone who learns the URL can put mail in
 *     the company's inbox from anybody.
 *   - Only the plain text part is stored. The HTML part would have to be
 *     sanitised before it could be displayed, and there is no version of that
 *     which is worth the risk for a mailbox nobody needs rich text in.
 *   - Whatever the provider says about SPF and DKIM is stored beside the
 *     sender, so the app can show that a message failed its checks rather than
 *     presenting a forgery as though it were verified.
 *   - Sizes are capped before anything is written.
 *
 * It writes with the service key. A mail provider has no session, and the
 * alternative — a table the browser could insert into — would let any
 * signed-in user forge an email from anyone.
 *
 * Some addresses do more than land in the inbox. `inbound_routes` says which:
 * mail to a `ticket` address opens a support ticket, and a reply to one becomes
 * a comment on it rather than a second ticket.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { smtpConfig, sendMail } from "../_shared/smtp.ts";

const MAX_BODY_BYTES = 1_000_000;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
const MAX_SUBJECT_CHARS = 998;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Constant time comparison.
 *
 * `a === b` on a secret returns as soon as two bytes differ, and the time it
 * took is a measurement of how much of the prefix was right. That is only worth
 * worrying about because this endpoint is reachable by anyone.
 */
function secretMatches(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** "Jane Bloggs <jane@example.com>" into its two halves. */
function parseAddress(raw: string): { name?: string; email: string } {
  const value = (raw ?? "").trim();
  const angled = value.match(/^(.*?)\s*<([^>]+)>$/);
  if (angled) {
    const name = angled[1].replace(/^["']|["']$/g, "").trim();
    return { name: name || undefined, email: angled[2].trim().toLowerCase() };
  }
  return { email: value.toLowerCase() };
}

const parseAddressList = (raw: string): string[] =>
  (raw ?? "")
    .split(",")
    .map((part) => parseAddress(part).email)
    .filter(Boolean);

/** The fields differ by provider; this accepts the common spellings of each. */
function pick(source: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const found = Object.keys(source).find((k) => k.toLowerCase() === name.toLowerCase());
    if (found && source[found]) return source[found];
  }
  return "";
}

/**
 * The ticket a message is a reply to, if any.
 *
 * Read from the subject rather than from In-Reply-To. Threading headers are
 * dropped or rewritten by enough mail clients that relying on them means a
 * customer's reply silently opening a duplicate ticket, which is worse than the
 * mild ugliness of a reference in the subject line.
 */
function ticketReferenceIn(subject: string): string | null {
  const found = subject.match(/\bT-\d{5,}\b/i);
  return found ? found[0].toUpperCase() : null;
}

type Incoming = {
  fields: Record<string, string>;
  files: { name: string; type: string; bytes: Uint8Array }[];
};

/**
 * Providers post multipart/form-data (SendGrid), form-encoded (Mailgun) or
 * JSON (Postmark). Reading all three keeps this from being tied to one.
 */
async function readRequest(req: Request): Promise<Incoming> {
  const contentType = req.headers.get("content-type") ?? "";
  const fields: Record<string, string> = {};
  const files: Incoming["files"] = [];

  if (contentType.includes("application/json")) {
    const payload = (await req.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === "string") fields[key] = value;
      else if (value != null && typeof value !== "object") fields[key] = String(value);
    }
    // Postmark sends attachments as base64 in the JSON body.
    const raw = (payload.Attachments ?? payload.attachments) as
      | { Name?: string; name?: string; Content?: string; content?: string; ContentType?: string }[]
      | undefined;
    for (const attachment of raw ?? []) {
      const base64 = attachment.Content ?? attachment.content;
      if (!base64) continue;
      files.push({
        name: attachment.Name ?? attachment.name ?? "attachment",
        type: attachment.ContentType ?? "application/octet-stream",
        bytes: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      });
    }
    return { fields, files };
  }

  const form = await req.formData();
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    } else {
      files.push({
        name: value.name || "attachment",
        type: value.type || "application/octet-stream",
        bytes: new Uint8Array(await value.arrayBuffer()),
      });
    }
  }
  return { fields, files };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  const expectedSecret = Deno.env.get("INBOUND_EMAIL_SECRET");
  if (!expectedSecret) {
    // Refusing is the safe failure. Accepting mail from anyone because the
    // secret was not configured is how an open relay into the inbox happens.
    return json(
      { error: "Inbound email is not configured. Set INBOUND_EMAIL_SECRET as a function secret." },
      503,
    );
  }

  const url = new URL(req.url);
  const given = req.headers.get("x-inbound-secret") ?? url.searchParams.get("secret") ?? "";
  if (!secretMatches(given, expectedSecret)) {
    return json({ error: "Not authorised." }, 401);
  }

  let incoming: Incoming;
  try {
    incoming = await readRequest(req);
  } catch (err) {
    return json({ error: `Could not read the message: ${String(err)}` }, 400);
  }

  const { fields, files } = incoming;

  const from = parseAddress(pick(fields, "from", "From", "sender"));
  if (!from.email) return json({ error: "No sender address." }, 400);

  // Truncated rather than refused: a message too big to store is still worth
  // knowing arrived, and the provider would otherwise retry it forever.
  const text = pick(fields, "text", "TextBody", "body-plain", "plain", "stripped-text");
  const truncated = text.length > MAX_BODY_BYTES;
  const body = truncated
    ? `${text.slice(0, MAX_BODY_BYTES)}\n\n[Truncated: the message was longer than this mailbox stores.]`
    : text;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    // Service key: the row must be written on behalf of a sender with no
    // session, and the table has no insert policy for anyone else.
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const spamRaw = pick(fields, "spam_score", "X-Spam-Score", "SpamScore");
  const spamScore = spamRaw && !Number.isNaN(Number(spamRaw)) ? Number(spamRaw) : null;

  const record = {
    provider_message_id:
      pick(fields, "MessageID", "message-id", "Message-Id", "message_id") || crypto.randomUUID(),
    from_address: from.email,
    from_name: from.name ?? null,
    to_addresses: parseAddressList(pick(fields, "to", "To", "recipient")),
    cc_addresses: parseAddressList(pick(fields, "cc", "Cc")),
    subject: pick(fields, "subject", "Subject").slice(0, MAX_SUBJECT_CHARS),
    body,
    spf: pick(fields, "SPF", "spf", "Received-SPF") || null,
    dkim: pick(fields, "dkim", "DKIM", "Dkim") || null,
    spam_score: spamScore,
    message_id: pick(fields, "Message-Id", "message-id", "MessageID") || null,
    in_reply_to: pick(fields, "In-Reply-To", "in-reply-to", "InReplyTo") || null,
  };

  // Providers retry on any non-2xx, so the same message arrives more than once.
  // A retry is acknowledged and otherwise ignored: the email was already
  // received, and rewriting the stored copy would both be wrong and be refused
  // by the trigger that keeps received mail immutable.
  const { data, error } = await supabase
    .from("inbound_emails")
    .upsert(record, { onConflict: "provider_message_id", ignoreDuplicates: true })
    .select("id");

  if (error) return json({ error: `Could not file the message: ${error.message}` }, 500);

  let emailId = data?.[0]?.id as string | undefined;
  if (!emailId) {
    // Nothing inserted, so this is a redelivery. Answer 200 with the id of the
    // copy already filed, or the provider keeps trying.
    const { data: existing } = await supabase
      .from("inbound_emails")
      .select("id")
      .eq("provider_message_id", record.provider_message_id)
      .maybeSingle();
    return json({ received: true, id: existing?.id ?? null, duplicate: true });
  }
  const stored: string[] = [];

  for (const file of files.slice(0, MAX_ATTACHMENTS)) {
    if (file.bytes.byteLength > MAX_ATTACHMENT_BYTES) continue;
    // Sanitised: the filename comes from the sender, and `../` in a storage
    // path is the oldest trick there is.
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "attachment";
    const path = `${emailId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("inbound-email-attachments")
      .upload(path, file.bytes, { contentType: file.type });
    if (uploadError) continue;

    await supabase.from("inbound_email_attachments").insert({
      email_id: emailId,
      storage_path: path,
      file_name: safeName,
      mime_type: file.type,
      size_bytes: file.bytes.byteLength,
    });
    stored.push(safeName);
  }

  // ---------------------------------------------------------------------
  // Routing
  //
  // A failure here must not fail the delivery: the mail is filed, and a
  // provider told the message was rejected redelivers it forever.
  // ---------------------------------------------------------------------
  let ticketOutcome: Record<string, unknown> = { routed: "inbox" };
  try {
    ticketOutcome = await route(supabase, record, emailId, stored);
  } catch (err) {
    ticketOutcome = { routed: "inbox", routingError: String(err) };
  }

  return json({ received: true, id: emailId, attachments: stored.length, truncated, ...ticketOutcome });
});

/**
 * Turns mail to a routed address into a ticket, or into a comment on the ticket
 * it is replying to.
 */
async function route(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
  emailId: string,
  attachmentNames: string[],
): Promise<Record<string, unknown>> {
  const recipients = (record.to_addresses as string[]) ?? [];
  const cc = (record.cc_addresses as string[]) ?? [];
  const all = [...recipients, ...cc];
  if (all.length === 0) return { routed: "inbox" };

  const { data: routes } = await supabase
    .from("inbound_routes")
    .select("address, action, category, priority")
    .eq("action", "ticket")
    .eq("active", true)
    .in("address", all);

  const match = routes?.[0];
  if (!match) return { routed: "inbox" };

  const subject = (record.subject as string) ?? "";
  const from = record.from_address as string;
  const body = (record.body as string) ?? "";
  const attachmentNote = attachmentNames.length
    ? `\n\n[Attached: ${attachmentNames.join(", ")} — see the original email.]`
    : "";

  // A reply to an existing ticket becomes a comment on it.
  const reference = ticketReferenceIn(subject);
  if (reference) {
    const { data: existing } = await supabase
      .from("tickets")
      .select("id, comments, status")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      comments.push({
        id: crypto.randomUUID(),
        author: from,
        ts: new Date().toISOString(),
        message: body + attachmentNote,
      });
      // A reply to something already resolved reopens it. Somebody writing back
      // is the clearest signal there is that it was not finished.
      const status = existing.status === "closed" || existing.status === "resolved"
        ? "open"
        : existing.status;
      await supabase
        .from("tickets")
        .update({ comments, status, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { routed: "ticket-comment", ticket: reference };
    }
  }

  // Otherwise a new ticket. Linked to a client if the sender is a known one,
  // so their history is in one place.
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", from)
    .maybeSingle();

  const { data: settings } = await supabase
    .from("support_settings")
    .select("sla_low, sla_medium, sla_high, sla_urgent")
    .eq("id", true)
    .maybeSingle();

  const priority = (match.priority as string) ?? "medium";
  const slaHours = Number(
    (settings as Record<string, unknown> | null)?.[`sla_${priority}`] ?? 48,
  );

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title: subject || "(no subject)",
      description: body + attachmentNote,
      requester: from,
      requester_email: from,
      client_id: client?.id ?? null,
      category: match.category ?? null,
      priority,
      status: "open",
      due_at: new Date(Date.now() + slaHours * 3600_000).toISOString(),
      source_email_id: emailId,
      comments: [],
    })
    .select("reference")
    .single();

  if (error) return { routed: "inbox", routingError: error.message };

  // Acknowledge it.
  //
  // Not a courtesy. The reference in this subject is the only thing the
  // customer has to reply to, and without it their next message opens a second
  // ticket instead of continuing this one. A failure to send is reported in the
  // result but does not undo the ticket — the request is in the queue either
  // way, which is what matters.
  const acknowledged = await acknowledge(supabase, from, ticket.reference as string, subject);

  return { routed: "ticket", ticket: ticket.reference, acknowledged };
}

async function acknowledge(
  supabase: ReturnType<typeof createClient>,
  to: string,
  reference: string,
  originalSubject: string,
): Promise<boolean> {
  const settings = smtpConfig();
  if ("error" in settings) return false;

  const subject = `[${reference}] ${originalSubject || "Your request"}`;
  const body =
    `Thank you — your request has been logged as ${reference}.\n\n` +
    `Someone will be in touch. Please keep ${reference} in the subject when ` +
    `replying, so your message reaches the same ticket.\n`;

  try {
    await sendMail(settings.config, { to: [to], subject, body });
  } catch (_) {
    return false;
  }

  // Recorded in the sent log like any other outgoing mail, so the trail of what
  // the customer was told is complete.
  await supabase.from("email_messages").insert({
    to_addresses: [to],
    subject,
    body,
    module: "support",
    status: "sent",
  });
  return true;
}

/**
 * Sends an email, optionally with a document attached.
 *
 * The app previously "sent" documents by opening a `mailto:` link. That hands
 * the job to whatever mail client the machine happens to have, cannot attach
 * anything, and silently does nothing on a machine with no client configured —
 * so an invoice could be marked as sent having gone nowhere. There was also an
 * SMTP settings form that kept the password in localStorage, readable by
 * anything running in the page.
 *
 * SMTP credentials belong on a server. They are set as function secrets and
 * never reach the browser; the caller supplies only the message.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { smtpConfig, sendMail } from "../_shared/smtp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Records what was attempted, and what came of it.
 *
 * Written here rather than by the browser because only this function knows
 * whether the mail server accepted the message. A client-written log would
 * record what the browser believed, which is the defect this replaces: the
 * recurring sweep used to write "sent" to localStorage without ever contacting
 * a mail server.
 *
 * A failure to log must not turn a delivered email into a reported failure, so
 * this never throws.
 */
async function record(
  asCaller: ReturnType<typeof createClient>,
  payload: Payload,
  recipients: string[],
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  try {
    await asCaller.from("email_messages").insert({
      to_addresses: recipients,
      cc_addresses: [],
      subject: payload.subject ?? "",
      body: payload.body ?? "",
      attachment_names: (payload.attachments ?? []).map((a) => a.filename),
      module: payload.module ?? null,
      status,
      error: error ?? null,
    });
  } catch (_) {
    // The mail itself is what matters; the log is secondary.
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type Attachment = { filename: string; contentBase64: string; contentType?: string };

type Payload = {
  to: string | string[];
  subject: string;
  /** Plain text. Kept simple deliberately: no HTML means nothing to sanitise. */
  body: string;
  attachments?: Attachment[];
  /** Module the caller must have edit rights on, e.g. "accounting". */
  module?: string;
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Not signed in." }, 401);

  // Bound to the caller's JWT, so has_access() runs as them. Sending mail on
  // the company's behalf is not something an unauthenticated caller may do.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: caller } = await asCaller.auth.getUser();
  if (!caller?.user) return json({ error: "Not signed in." }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const recipients = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map((r) => String(r ?? "").trim())
    .filter(Boolean);

  if (recipients.length === 0) return json({ error: "No recipient was given." }, 400);
  const invalid = recipients.filter((r) => !EMAIL_RE.test(r));
  if (invalid.length) return json({ error: `Not a valid email address: ${invalid.join(", ")}` }, 400);
  if (!payload.subject?.trim()) return json({ error: "A subject is required." }, 400);

  // Only somebody who may edit the module may email its documents.
  const moduleName = payload.module ?? "accounting";
  const { data: allowed, error: accessError } = await asCaller.rpc("has_access", {
    target_module: moduleName,
    required: "edit",
  });
  if (accessError) return json({ error: accessError.message }, 500);
  if (allowed !== true) {
    return json({ error: `You need edit access to ${moduleName} to send this.` }, 403);
  }

  for (const attachment of payload.attachments ?? []) {
    // base64 is about 4/3 of the encoded size.
    if ((attachment.contentBase64?.length ?? 0) * 0.75 > MAX_ATTACHMENT_BYTES) {
      return json({ error: `${attachment.filename} is too large to email.` }, 400);
    }
  }

  const settings = smtpConfig();
  if ("error" in settings) return json({ error: settings.error }, 503);

  try {
    await sendMail(settings.config, {
      to: recipients,
      subject: payload.subject,
      body: payload.body ?? "",
      attachments: payload.attachments,
    });
  } catch (err) {
    const message = `The mail server rejected the message: ${String(err)}`;
    await record(asCaller, payload, recipients, "failed", message);
    return json({ error: message }, 502);
  }

  await record(asCaller, payload, recipients, "sent");
  return json({ sent: true, to: recipients });
});

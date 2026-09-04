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
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const username = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");
  const fromAddress = Deno.env.get("SMTP_FROM");
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "";

  if (!host || !fromAddress) {
    // Named explicitly. "Failed to send" would send someone hunting through
    // application code for a configuration problem.
    return json(
      {
        error:
          "Email is not configured on the server. Set SMTP_HOST and SMTP_FROM " +
          "as function secrets (plus SMTP_USER and SMTP_PASSWORD if the server " +
          "requires authentication).",
      },
      503,
    );
  }

  // Credentials are optional: an internal relay that accepts mail from its own
  // network without authenticating is a normal arrangement. What is not
  // negotiable is sending a password in the clear — the library refuses, and
  // rightly, so the two must be configured together.
  const authenticate = Boolean(username && password);
  // 465 is implicit TLS; 587 upgrades with STARTTLS.
  const secure = port === 465;
  const allowInsecure = Deno.env.get("SMTP_INSECURE") === "true";

  if (authenticate && !secure && !allowInsecure) {
    return json(
      {
        error:
          `SMTP_USER is set but port ${port} is not a TLS port, so the password ` +
          "would be sent in the clear. Use port 465, or drop the credentials if " +
          "the relay does not need them.",
      },
      503,
    );
  }

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: secure,
      ...(authenticate ? { auth: { username: username!, password: password! } } : {}),
    },
    // The library refuses a plaintext connection unless told explicitly, which
    // is the right default — SMTP_INSECURE is the deliberate opt-in, and exists
    // for a local mail catcher or an internal relay on a trusted network.
    ...(allowInsecure ? { debug: { allowUnsecure: true } } : {}),
  });

  try {
    await client.send({
      from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      to: recipients,
      subject: payload.subject,
      content: payload.body ?? "",
      attachments: (payload.attachments ?? []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType ?? "application/pdf",
        encoding: "base64" as const,
        content: a.contentBase64,
      })),
    });
  } catch (err) {
    const message = `The mail server rejected the message: ${String(err)}`;
    await record(asCaller, payload, recipients, "failed", message);
    return json({ error: message }, 502);
  } finally {
    // Leaving the connection open exhausts the provider's limit after a few
    // sends, which looks like intermittent failure.
    try {
      await client.close();
    } catch {
      // Already closed.
    }
  }

  await record(asCaller, payload, recipients, "sent");
  return json({ sent: true, to: recipients });
});

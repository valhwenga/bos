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
/**
 * Resolves the address to send as.
 *
 * The caller names an address; this decides whether they may use it. A raw From
 * header from the client would let any signed-in user send as the managing
 * director, or as a customer, from inside the company's own relay — a far more
 * convincing forgery than anything an outsider can produce.
 *
 * With no identity asked for, or none configured, the answer is SMTP_FROM,
 * which is what happened before identities existed.
 */
async function resolveIdentity(
  asCaller: ReturnType<typeof createClient>,
  requested: string | undefined,
  fallbackAddress: string,
  fallbackName: string,
): Promise<{ address: string; name: string } | { error: string }> {
  if (!requested) return { address: fallbackAddress, name: fallbackName };

  const wanted = requested.trim().toLowerCase();
  const { data } = await asCaller
    .from("send_identities")
    .select("address, display_name, module, active")
    .eq("address", wanted)
    .maybeSingle();

  // Row level security also hides identities from a caller who may not send at
  // all, so "not found" covers both cases and says the same thing either way.
  if (!data || !data.active) {
    return { error: `${wanted} is not an address this system may send as.` };
  }

  // An identity tied to a module is usable only by somebody who can edit it,
  // so a support agent cannot send as accounts@.
  if (data.module) {
    const { data: allowed } = await asCaller.rpc("has_access", {
      target_module: data.module,
      required: "edit",
    });
    if (allowed !== true) {
      return { error: `You need edit access to ${data.module} to send as ${wanted}.` };
    }
  }

  return { address: wanted, name: (data.display_name as string) ?? "" };
}

async function record(
  asCaller: ReturnType<typeof createClient>,
  payload: Payload,
  recipients: string[],
  status: "sent" | "failed",
  error?: string,
  fromAddress?: string,
): Promise<void> {
  try {
    await asCaller.from("email_messages").insert({
      to_addresses: recipients,
      cc_addresses: [],
      subject: payload.subject ?? "",
      body: payload.body ?? "",
      attachment_names: (payload.attachments ?? []).map((a) => a.filename),
      module: payload.module ?? null,
      from_address: fromAddress ?? null,
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
  /**
   * Which of the company's addresses to send as. An address, not a display
   * name and not a raw From header: it is looked up in send_identities and
   * refused if it is not there.
   */
  fromIdentity?: string;
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

  const identity = await resolveIdentity(
    asCaller,
    payload.fromIdentity,
    settings.config.fromAddress,
    settings.config.fromName,
  );
  if ("error" in identity) return json({ error: identity.error }, 403);

  try {
    await sendMail(settings.config, {
      to: recipients,
      subject: payload.subject,
      body: payload.body ?? "",
      attachments: payload.attachments,
      from: identity,
    });
  } catch (err) {
    const message = `The mail server rejected the message: ${String(err)}`;
    await record(asCaller, payload, recipients, "failed", message, identity.address);
    return json({ error: message }, 502);
  }

  await record(asCaller, payload, recipients, "sent", undefined, identity.address);
  return json({ sent: true, to: recipients, from: identity.address });
});

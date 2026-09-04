/**
 * Sending mail over SMTP.
 *
 * Shared by send-email, which the app calls, and receive-email, which
 * acknowledges a ticket raised by a customer. Both need the same connection
 * rules and the same refusal to put a password on the wire in the clear; having
 * that in one place is the difference between fixing it once and fixing it in
 * whichever copy someone remembers.
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export type OutgoingAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

export type SmtpConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  fromAddress: string;
  fromName: string;
  secure: boolean;
  allowInsecure: boolean;
};

/**
 * Reads the configuration, or explains precisely what is missing.
 *
 * Named settings rather than "email is broken": the difference between a
 * misconfigured relay and application code is the first thing anybody
 * diagnosing this needs to know.
 */
export function smtpConfig(): { config: SmtpConfig } | { error: string } {
  const host = Deno.env.get("SMTP_HOST");
  const fromAddress = Deno.env.get("SMTP_FROM");
  if (!host || !fromAddress) {
    return {
      error:
        "Email is not configured on the server. Set SMTP_HOST and SMTP_FROM " +
        "as function secrets (plus SMTP_USER and SMTP_PASSWORD if the server " +
        "requires authentication).",
    };
  }

  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const username = Deno.env.get("SMTP_USER") ?? undefined;
  const password = Deno.env.get("SMTP_PASSWORD") ?? undefined;
  const authenticate = Boolean(username && password);
  // 465 is implicit TLS; 587 upgrades with STARTTLS.
  const secure = port === 465;
  const allowInsecure = Deno.env.get("SMTP_INSECURE") === "true";

  // Credentials are optional: an internal relay that accepts mail from its own
  // network without authenticating is a normal arrangement. What is not
  // negotiable is sending a password in the clear.
  if (authenticate && !secure && !allowInsecure) {
    return {
      error:
        `SMTP_USER is set but port ${port} is not a TLS port, so the password ` +
        "would be sent in the clear. Use port 465, or drop the credentials if " +
        "the relay does not need them.",
    };
  }

  return {
    config: {
      host,
      port,
      username,
      password,
      fromAddress,
      fromName: Deno.env.get("SMTP_FROM_NAME") ?? "",
      secure,
      allowInsecure,
    },
  };
}

/** Sends one message. Throws with the server's own words on refusal. */
export async function sendMail(
  config: SmtpConfig,
  message: {
    to: string[];
    subject: string;
    body: string;
    attachments?: OutgoingAttachment[];
    /**
     * Which address to send as. Already validated by the caller against the
     * identities the company has configured — this does no checking of its own,
     * and must never be handed something a client supplied.
     */
    from?: { address: string; name: string };
  },
): Promise<void> {
  const authenticate = Boolean(config.username && config.password);

  const client = new SMTPClient({
    connection: {
      hostname: config.host,
      port: config.port,
      tls: config.secure,
      ...(authenticate
        ? { auth: { username: config.username!, password: config.password! } }
        : {}),
    },
    // The library refuses a plaintext connection unless told explicitly, which
    // is the right default — SMTP_INSECURE is the deliberate opt-in, and exists
    // for a local mail catcher or an internal relay on a trusted network.
    ...(config.allowInsecure ? { debug: { allowUnsecure: true } } : {}),
  });

  try {
    await client.send({
      from: (() => {
        const address = message.from?.address ?? config.fromAddress;
        const name = message.from?.name ?? config.fromName;
        return name ? `${name} <${address}>` : address;
      })(),
      to: message.to,
      subject: message.subject,
      content: message.body,
      attachments: (message.attachments ?? []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType ?? "application/pdf",
        encoding: "base64" as const,
        content: a.contentBase64,
      })),
    });
  } finally {
    // Leaving the connection open exhausts the provider's limit after a few
    // sends, which looks like intermittent failure.
    try {
      await client.close();
    } catch {
      // Already closed.
    }
  }
}

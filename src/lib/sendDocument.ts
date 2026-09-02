/**
 * Emails a document from the system.
 *
 * The send happens in the send-email edge function, because SMTP credentials
 * must not be in a browser. What this module owns is turning a document into a
 * PDF and composing sensible default wording.
 */

import { supabase } from "./supabase";
import type { Invoice, Quotation } from "./accountingStore";
import { CompanySettingsStore } from "./companySettings";
import {
  buildDocumentPdf,
  documentFileName,
  documentTotals,
  pdfToBase64,
  type DocumentKind,
} from "./documentPdf";

export type SendResult = { sent: true; to: string[] };

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  body: string;
  attachments?: { filename: string; contentBase64: string; contentType?: string }[];
  module?: string;
}): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke("send-email", { body: params });

  if (error) {
    // The function's own message is far more useful than "Edge Function
    // returned a non-2xx status code", which is all `error.message` says —
    // it is the difference between "SMTP is not configured" and a mystery.
    const detail = (data as { error?: string } | null)?.error;
    let fromBody: string | undefined;
    const res = (error as { context?: Response }).context;
    if (!detail && res && typeof res.json === "function") {
      try {
        fromBody = ((await res.clone().json()) as { error?: string }).error;
      } catch {
        /* not JSON */
      }
    }
    throw new Error(detail ?? fromBody ?? error.message);
  }
  return data as SendResult;
}

/** Default subject and body, which the send dialog lets the user edit. */
export function draftDocumentEmail(doc: Invoice | Quotation, kind: DocumentKind) {
  const company = CompanySettingsStore.get();
  const symbol = company.currencySymbol || "R";
  const label = kind === "quotation" ? "Quotation" : "Invoice";
  const total = documentTotals(doc).grand.toFixed(2);
  const name = doc.customer?.name || doc.customer?.companyName || "there";

  const lines = [
    `Dear ${name},`,
    "",
    `Please find ${label.toLowerCase()} ${doc.number} attached, for ${symbol}${total}.`,
  ];

  if (kind === "quotation" && (doc as Quotation).expiryDate) {
    lines.push(
      `This quotation is valid until ${new Date((doc as Quotation).expiryDate!).toLocaleDateString("en-GB")}.`,
    );
  }
  if (kind === "invoice" && (doc as Invoice).dueDate) {
    lines.push(`Payment is due by ${new Date((doc as Invoice).dueDate!).toLocaleDateString("en-GB")}.`);
  }
  if (company.bankName || company.bankAccount) {
    lines.push("", "Banking details are on the attached document.", `Please use ${doc.number} as your reference.`);
  }

  lines.push("", "Kind regards,", company.name || "");

  return {
    to: doc.customer?.email ?? "",
    subject: `${label} ${doc.number} from ${company.name || "us"}`,
    body: lines.join("\n"),
  };
}

/** Builds the PDF and sends it. */
export async function sendDocument(
  doc: Invoice | Quotation,
  kind: DocumentKind,
  message: { to: string; subject: string; body: string },
): Promise<SendResult> {
  const pdf = await buildDocumentPdf(doc, kind);
  const contentBase64 = await pdfToBase64(pdf);

  return sendEmail({
    to: message.to,
    subject: message.subject,
    body: message.body,
    module: "accounting",
    attachments: [
      { filename: documentFileName(doc, kind), contentBase64, contentType: "application/pdf" },
    ],
  });
}

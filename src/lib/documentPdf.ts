/**
 * Renders an invoice or quotation to a PDF file.
 *
 * The print pages produce an A4 sheet in the browser, which is right for
 * printing but cannot be attached to anything. Emailing a document needs actual
 * bytes, so this builds one with jsPDF — bundled, so it works offline and
 * cannot be broken by a CDN.
 *
 * The layout deliberately mirrors the printed sheet: same header, same columns,
 * same banking block. A customer should not receive something that looks
 * unrelated to what the office printed.
 */

import type { Invoice, Quotation } from "./accountingStore";
import { CompanySettingsStore } from "./companySettings";

type Document = Invoice | Quotation;

/**
 * Which kind of document this is.
 *
 * Passed in rather than inferred. Both types share statuses — "draft" and
 * "sent" are valid for each — so guessing from the shape labelled a draft
 * invoice as a quotation, which put the wrong heading on the page and the wrong
 * name on the attachment sent to the customer.
 */
export type DocumentKind = "invoice" | "quotation";

export function documentTotals(doc: Document) {
  const subtotal = doc.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = doc.discountPct ? (subtotal * doc.discountPct) / 100 : 0;
  const shipping = doc.shipping ?? 0;
  const grand = Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, grand };
}

/** A filename a customer can recognise in their downloads folder. */
export function documentFileName(doc: Document, kind: DocumentKind): string {
  const label = kind === "quotation" ? "Quotation" : "Invoice";
  return `${label}-${doc.number}.pdf`.replace(/[^\w.\-]+/g, "-");
}

export async function buildDocumentPdf(doc: Document, kind: DocumentKind): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const company = CompanySettingsStore.get();
  const symbol = company.currencySymbol || "R";
  const money = (n: number) => `${symbol}${n.toFixed(2)}`;
  const quotation = kind === "quotation";

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // --- Header -------------------------------------------------------------
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text(quotation ? "QUOTATION" : "INVOICE", pageWidth - margin, y + 4, { align: "right" });

  pdf.setFontSize(11);
  pdf.text(company.name || "", margin, y + 4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  let headerY = y + 9;
  for (const line of [company.address, company.email, company.phone].filter(Boolean)) {
    // An address can be multi-line, and a stray newline would print as a box.
    for (const part of String(line).split("\n")) {
      pdf.text(part, margin, headerY);
      headerY += 4;
    }
  }

  pdf.setFontSize(9);
  let metaY = y + 10;
  const meta: [string, string][] = [
    [quotation ? "Quotation No" : "Invoice No", doc.number],
    ["Date", new Date(doc.createdAt).toLocaleDateString("en-GB")],
  ];
  if (quotation && (doc as Quotation).expiryDate) {
    meta.push(["Valid Until", new Date((doc as Quotation).expiryDate!).toLocaleDateString("en-GB")]);
  }
  if (!quotation && (doc as Invoice).dueDate) {
    meta.push(["Due", new Date((doc as Invoice).dueDate!).toLocaleDateString("en-GB")]);
  }
  for (const [label, value] of meta) {
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}:`, pageWidth - margin - 32, metaY);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, pageWidth - margin, metaY, { align: "right" });
    metaY += 5;
  }

  y = Math.max(headerY, metaY) + 4;
  pdf.setDrawColor(200);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  // --- Bill to ------------------------------------------------------------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("BILL TO", margin, y);
  y += 5;
  pdf.setFontSize(10);
  pdf.text(doc.customer?.companyName || doc.customer?.name || "", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  y += 4.5;
  for (const line of [doc.customer?.name, doc.customer?.email, doc.customer?.phone].filter(Boolean)) {
    pdf.text(String(line), margin, y);
    y += 4.5;
  }
  y += 4;

  // --- Items --------------------------------------------------------------
  const columns = { name: margin, price: 108, qty: 140, total: pageWidth - margin };

  const drawHeader = () => {
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, y - 4.5, pageWidth - margin * 2, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Description", columns.name + 1, y);
    pdf.text("Unit Price", columns.price, y, { align: "right" });
    pdf.text("Qty", columns.qty, y, { align: "right" });
    pdf.text("Total", columns.total - 1, y, { align: "right" });
    pdf.setFont("helvetica", "normal");
    y += 7;
  };
  drawHeader();

  for (const item of doc.items) {
    // A long description wraps, so the row height has to be measured before
    // deciding whether it fits — otherwise the last line lands on the margin.
    const nameLines = pdf.splitTextToSize(item.name, columns.price - margin - 6) as string[];
    const descLines = item.description
      ? (pdf.splitTextToSize(item.description, columns.price - margin - 6) as string[])
      : [];
    const rowHeight = nameLines.length * 4.5 + descLines.length * 3.8 + 2;

    // Leave room for the totals and banking block.
    if (y + rowHeight > pageHeight - 60) {
      pdf.addPage();
      y = margin;
      drawHeader();
    }

    pdf.setFontSize(9);
    let lineY = y;
    for (const line of nameLines) {
      pdf.text(line, columns.name + 1, lineY);
      lineY += 4.5;
    }
    if (descLines.length) {
      pdf.setFontSize(7.5);
      pdf.setTextColor(110);
      for (const line of descLines) {
        pdf.text(line, columns.name + 1, lineY);
        lineY += 3.8;
      }
      pdf.setTextColor(0);
      pdf.setFontSize(9);
    }

    pdf.text(money(item.price), columns.price, y, { align: "right" });
    pdf.text(String(item.qty), columns.qty, y, { align: "right" });
    pdf.text(money(item.qty * item.price), columns.total - 1, y, { align: "right" });

    y = lineY + 2;
    pdf.setDrawColor(230);
    pdf.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
  }

  // --- Totals -------------------------------------------------------------
  const totals = documentTotals(doc);
  y += 4;
  const totalRow = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(bold ? 11 : 9);
    pdf.text(label, columns.qty, y, { align: "right" });
    pdf.text(value, columns.total - 1, y, { align: "right" });
    y += bold ? 7 : 5;
  };
  totalRow("Subtotal", money(totals.subtotal));
  if (totals.discount > 0) totalRow(`Discount (${doc.discountPct}%)`, `-${money(totals.discount)}`);
  if (totals.shipping > 0) totalRow("Shipping", money(totals.shipping));
  totalRow("TOTAL", money(totals.grand), true);

  // --- Banking ------------------------------------------------------------
  if (company.bankName || company.bankAccount) {
    y += 3;
    pdf.setDrawColor(200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Banking Details", margin, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const bank: [string, string | undefined][] = [
      ["Bank", company.bankName],
      ["Account", company.bankAccount],
      ["Branch Code", company.branchCode],
      ["Reference", doc.number],
    ];
    for (const [label, value] of bank) {
      if (!value) continue;
      pdf.text(`${label}: ${value}`, margin, y);
      y += 4;
    }
  }

  if (company.footerNote) {
    pdf.setFontSize(7.5);
    pdf.setTextColor(120);
    pdf.text(pdf.splitTextToSize(company.footerNote, pageWidth - margin * 2) as string[], margin, pageHeight - 14);
    pdf.setTextColor(0);
  }

  return pdf.output("blob");
}

/** Base64 without the data-URL prefix, which is what the mail API wants. */
export async function pdfToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked: spreading a large array into fromCharCode overflows the stack.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

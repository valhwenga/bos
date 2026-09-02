/**
 * Quotations and invoices.
 *
 * These used to live in localStorage, which meant every user had their own
 * private copy of the company's books: an invoice raised on one machine did not
 * exist on any other, and clearing the browser destroyed the lot. They are rows
 * in Postgres now, shared and backed up, with row level security deciding who
 * may see them.
 *
 * The read methods stay synchronous and keep their names, served from a cache,
 * so the pages and print sheets did not have to be rewritten. The writes are
 * async, because a write can now fail — the network, a permission, a constraint
 * — and a caller has to be able to find that out. That is the real change in
 * this module's contract.
 */

import type { Customer as RichCustomer } from "@/lib/customersStore";
import { allocateNumber } from "@/lib/documentNumbers";
import { createCache } from "./collectionCache";
import { InvoiceRepo, QuotationRepo } from "./accountingRepo";
import { PaymentStore } from "./paymentStore";

export type Customer = RichCustomer;
export type LineItem = { id: string; name: string; qty: number; price: number; description?: string };
export type Quotation = {
  id: string;
  number: string;
  customer: Customer;
  items: LineItem[];
  /** "converted" means an invoice has been raised from this quote. */
  status: "draft" | "sent" | "accepted" | "declined" | "converted";
  createdAt: string;
  notes?: string;
  reference?: string;
  expiryDate?: string; // ISO
  subject?: string;
  salesperson?: string;
  projectName?: string;
  discountPct?: number; // 0-100
  shipping?: number; // currency amount
  useShippingAddress?: boolean;
  logoDataUrl?: string;
  signatureDataUrl?: string;
};
export type Invoice = { id: string; number: string; customer: Customer; items: LineItem[]; status: "draft" | "sent" | "paid" | "overdue"; createdAt: string; updatedAt?: string; sourceQuoteId?: string; useShippingAddress?: boolean; discountPct?: number; shipping?: number; dueDate?: string; reference?: string; notes?: string };

export const quotationsCache = createCache<Quotation>(() => QuotationRepo.list());
export const invoicesCache = createCache<Invoice>(() => InvoiceRepo.list());

export const AccountingStore = {
  listQuotes(): Quotation[] {
    return quotationsCache.list();
  },
  listInvoices(): Invoice[] {
    return invoicesCache.list();
  },

  /** Loads both collections; call before reading if you need them populated. */
  async load(): Promise<void> {
    await Promise.all([quotationsCache.ensureLoaded(), invoicesCache.ensureLoaded()]);
  },

  async upsertQuote(q: Quotation): Promise<Quotation> {
    await quotationsCache.mutate(() => QuotationRepo.upsert(q));
    return q;
  },
  async upsertInvoice(iw: Invoice): Promise<Invoice> {
    await invoicesCache.mutate(() => InvoiceRepo.upsert(iw));
    return iw;
  },
  async removeInvoice(invoiceId: string): Promise<void> {
    await invoicesCache.mutate(() => InvoiceRepo.remove(invoiceId));
  },
  async removeQuote(quoteId: string): Promise<void> {
    await quotationsCache.mutate(() => QuotationRepo.remove(quoteId));
  },

  async convertQuoteToInvoice(quoteId: string): Promise<Invoice | undefined> {
    const q = this.listQuotes().find((x) => x.id === quoteId);
    if (!q) return undefined;

    const invoice: Invoice = {
      id: `inv_${Date.now()}`,
      number: await allocateNumber("invoice"),
      customer: q.customer,
      items: q.items,
      status: "draft",
      createdAt: new Date().toISOString(),
      sourceQuoteId: q.id,
      useShippingAddress: q.useShippingAddress,
    };
    await this.upsertInvoice(invoice);

    // Mark the quote converted, matching the conversion path in the Payments
    // page. These two previously disagreed, leaving "accepted" quotes that had
    // in fact already been invoiced.
    await this.upsertQuote({ ...q, status: "converted" });

    // Carry over deposits recorded against the quote to the new invoice.
    for (const p of PaymentStore.byQuote(q.id)) {
      await PaymentStore.update({ ...p, quoteId: undefined, invoiceId: invoice.id });
    }
    return invoice;
  },
};

/**
 * Payments received against invoices, and deposits against quotations.
 *
 * Now rows in Postgres rather than a localStorage array. Reads stay synchronous
 * from a cache so the pages that total them during render keep working; writes
 * are async because they can fail.
 */

import { createCache } from "./collectionCache";
import { PaymentRepo } from "./accountingRepo";

export type PaymentMethod = "Cash" | "EFT/Bank Transfer" | "Card" | "Other";

export type Payment = {
  id: string;
  customerId: string;
  invoiceId?: string;
  quoteId?: string; // treated as deposit when applied to a quote
  amount: number;
  currencyCode: string;
  date: string; // ISO
  method: PaymentMethod;
  reference?: string; // e.g., bank ref
  notes?: string;
  paymentType?: "full" | "partial" | "overpayment"; // Track payment type
};

export const paymentsCache = createCache<Payment>(() => PaymentRepo.list());

/** Kept so the screens that listen for this still refresh on a change. */
const announce = () => {
  try {
    window.dispatchEvent(new Event("payments-changed"));
  } catch {
    void 0;
  }
};

export const PaymentStore = {
  list(): Payment[] {
    return paymentsCache.list();
  },
  load(): Promise<Payment[]> {
    return paymentsCache.ensureLoaded();
  },

  async add(p: Payment): Promise<Payment> {
    await paymentsCache.mutate(() => PaymentRepo.upsert(p));
    announce();
    return p;
  },
  async update(p: Payment): Promise<Payment> {
    await paymentsCache.mutate(() => PaymentRepo.upsert(p));
    announce();
    return p;
  },
  async remove(id: string): Promise<void> {
    await paymentsCache.mutate(() => PaymentRepo.remove(id));
    announce();
  },

  byInvoice(invoiceId: string) {
    return this.list().filter((p) => p.invoiceId === invoiceId);
  },
  byQuote(quoteId: string) {
    return this.list().filter((p) => p.quoteId === quoteId);
  },
  byCustomer(customerId: string) {
    return this.list().filter((p) => p.customerId === customerId);
  },
  sumAmount(ps: Payment[]) {
    return ps.reduce((s, p) => s + (p.amount || 0), 0);
  },
};

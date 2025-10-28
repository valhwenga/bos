import { PaymentStore } from "@/lib/paymentStore";
import type { Customer as RichCustomer } from "@/lib/customersStore";

export type Customer = RichCustomer;
export type LineItem = { id: string; name: string; qty: number; price: number; description?: string };
export type Quotation = {
  id: string;
  number: string;
  customer: Customer;
  items: LineItem[];
  status: "draft" | "sent" | "accepted" | "declined";
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
};
export type Invoice = { id: string; number: string; customer: Customer; items: LineItem[]; status: "draft" | "sent" | "paid" | "overdue"; createdAt: string; sourceQuoteId?: string; useShippingAddress?: boolean };

const KEY = {
  quotes: "acct.quotes",
  invoices: "acct.invoices",
};

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const AccountingStore = {
  listQuotes(): Quotation[] {
    return read<Quotation[]>(KEY.quotes, []);
  },
  listInvoices(): Invoice[] {
    return read<Invoice[]>(KEY.invoices, []);
  },
  upsertQuote(q: Quotation) {
    const all = this.listQuotes();
    const i = all.findIndex((x) => x.id === q.id);
    if (i >= 0) all[i] = q; else all.push(q);
    write(KEY.quotes, all);
    return q;
  },
  upsertInvoice(iw: Invoice) {
    const all = this.listInvoices();
    const i = all.findIndex((x) => x.id === iw.id);
    if (i >= 0) all[i] = iw; else all.push(iw);
    write(KEY.invoices, all);
    return iw;
  },
  convertQuoteToInvoice(quoteId: string): Invoice | undefined {
    const quotes = this.listQuotes();
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return undefined;
    const invoice: Invoice = {
      id: `inv_${Date.now()}`,
      number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      customer: q.customer,
      items: q.items,
      status: "draft",
      createdAt: new Date().toISOString(),
      sourceQuoteId: q.id,
      useShippingAddress: q.useShippingAddress,
    };
    this.upsertInvoice(invoice);
    // Optionally mark quote as accepted
    q.status = "accepted";
    this.upsertQuote(q);
    // Carry over deposits recorded against the quote to the new invoice
    try {
      const deposits = PaymentStore.byQuote(q.id);
      deposits.forEach((p) => {
        PaymentStore.update({ ...p, quoteId: undefined, invoiceId: invoice.id });
      });
    } catch {}
    return invoice;
  },
};

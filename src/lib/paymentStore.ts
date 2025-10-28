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
};

const KEY = { payments: "acct.payments" };

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const PaymentStore = {
  list(): Payment[] { return read<Payment[]>(KEY.payments, []); },
  add(p: Payment) { const all = this.list(); all.push(p); write(KEY.payments, all); try { window.dispatchEvent(new Event('payments-changed')); } catch {} return p; },
  update(p: Payment) { const all = this.list(); const i = all.findIndex(x=> x.id===p.id); if (i>=0) all[i]=p; write(KEY.payments, all); try { window.dispatchEvent(new Event('payments-changed')); } catch {} return p; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); write(KEY.payments, all); try { window.dispatchEvent(new Event('payments-changed')); } catch {} },
  byInvoice(invoiceId: string) { return this.list().filter(p=> p.invoiceId===invoiceId); },
  byQuote(quoteId: string) { return this.list().filter(p=> p.quoteId===quoteId); },
  byCustomer(customerId: string) { return this.list().filter(p=> p.customerId===customerId); },
  sumAmount(ps: Payment[]) { return ps.reduce((s,p)=> s + (p.amount||0), 0); },
};

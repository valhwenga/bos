/**
 * Credit notes, and how they are applied against invoices.
 *
 * Rows in Postgres now. The applications are their own table rather than a
 * jsonb column: a credit applied to an invoice is a financial link, and it
 * should be joinable and constrained rather than a blob.
 */

import { createCache } from "./collectionCache";
import { CreditNoteRepo } from "./accountingRepo";

export type CreditApply = { invoiceId: string; amount: number };
export type CreditNote = {
  id: string;
  number: string;
  date: string; // ISO date YYYY-MM-DD
  customerId: string;
  customerName?: string;
  amount: number; // total credit amount
  applied?: CreditApply[]; // how it's applied to invoices
  notes?: string;
  createdAt: string;
};

export const creditNotesCache = createCache<CreditNote>(() => CreditNoteRepo.list());

const announce = () => {
  try {
    window.dispatchEvent(new Event("acct.credits-changed"));
  } catch {
    void 0;
  }
};

export const CreditNotesStore = {
  list(): CreditNote[] {
    return creditNotesCache.list();
  },
  load(): Promise<CreditNote[]> {
    return creditNotesCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(cn: CreditNote): Promise<CreditNote> {
    await creditNotesCache.mutate(() => CreditNoteRepo.upsert(cn));
    announce();
    return cn;
  },
  async remove(id: string): Promise<void> {
    await creditNotesCache.mutate(() => CreditNoteRepo.remove(id));
    announce();
  },
  sumAppliedToInvoice(invoiceId: string) {
    return this.list().reduce(
      (s, cn) =>
        s +
        (cn.applied || [])
          .filter((a) => a.invoiceId === invoiceId)
          .reduce((sa, a) => sa + a.amount, 0),
      0,
    );
  },
};
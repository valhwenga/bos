/**
 * One-time import of accounting data from localStorage into Postgres.
 *
 * Whatever is already in a browser predates the move to the database. Switching
 * the stores over without this would leave that data stranded: still in
 * localStorage, invisible to the app, and lost the moment the cache is cleared.
 *
 * Safe to run more than once. Every row is written by its original id, so a
 * second run updates the same rows rather than creating duplicates — the thing
 * that would otherwise turn a nervous re-run into double-counted revenue.
 */

import { CustomerRepo, InvoiceRepo, PaymentRepo, QuotationRepo } from "./accountingRepo";
import type { Invoice, Quotation } from "./accountingStore";
import type { Payment } from "./paymentStore";
import type { Customer } from "./customersStore";

const LEGACY_KEYS = {
  quotes: "acct.quotes",
  invoices: "acct.invoices",
  payments: "acct.payments",
  customers: "acct.customers",
} as const;

function readLegacy<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export type ImportCounts = {
  customers: number;
  quotations: number;
  invoices: number;
  payments: number;
};

export type ImportReport = {
  found: ImportCounts;
  imported: ImportCounts;
  failures: { kind: keyof ImportCounts; id: string; label: string; reason: string }[];
};

/** What is sitting in this browser, without writing anything. */
export function findLocalData(): ImportCounts {
  return {
    customers: readLegacy<Customer>(LEGACY_KEYS.customers).length,
    quotations: readLegacy<Quotation>(LEGACY_KEYS.quotes).length,
    invoices: readLegacy<Invoice>(LEGACY_KEYS.invoices).length,
    payments: readLegacy<Payment>(LEGACY_KEYS.payments).length,
  };
}

export function hasLocalData(): boolean {
  const c = findLocalData();
  return c.customers + c.quotations + c.invoices + c.payments > 0;
}

/**
 * Copies local rows into Postgres.
 *
 * Order matters: customers first, then quotations, then invoices (which may
 * reference a quotation), then payments (which reference both). A row whose
 * parent failed is reported rather than silently dropped.
 *
 * Nothing is deleted from localStorage. If the import is wrong the original is
 * still there to retry from, and removing it is a separate, deliberate step.
 */
export async function importLocalData(): Promise<ImportReport> {
  const report: ImportReport = {
    found: findLocalData(),
    imported: { customers: 0, quotations: 0, invoices: 0, payments: 0 },
    failures: [],
  };

  const fail = (kind: keyof ImportCounts, id: string, label: string, err: unknown) =>
    report.failures.push({
      kind,
      id,
      label,
      reason: err instanceof Error ? err.message : String(err),
    });

  // Customers referenced only by a document are created by the document's own
  // write, but importing the address book first keeps customers that have no
  // documents yet.
  for (const customer of readLegacy<Customer>(LEGACY_KEYS.customers)) {
    try {
      await CustomerRepo.upsert(customer);
      report.imported.customers += 1;
    } catch (err) {
      fail("customers", customer.id, customer.name || customer.id, err);
    }
  }

  for (const quote of readLegacy<Quotation>(LEGACY_KEYS.quotes)) {
    try {
      await QuotationRepo.upsert(quote);
      report.imported.quotations += 1;
    } catch (err) {
      fail("quotations", quote.id, quote.number || quote.id, err);
    }
  }

  for (const invoice of readLegacy<Invoice>(LEGACY_KEYS.invoices)) {
    try {
      await InvoiceRepo.upsert(invoice);
      report.imported.invoices += 1;
    } catch (err) {
      fail("invoices", invoice.id, invoice.number || invoice.id, err);
    }
  }

  for (const payment of readLegacy<Payment>(LEGACY_KEYS.payments)) {
    try {
      await PaymentRepo.upsert(payment);
      report.imported.payments += 1;
    } catch (err) {
      fail("payments", payment.id, payment.reference || payment.id, err);
    }
  }

  return report;
}

/**
 * Moves the imported keys aside once the import has been checked.
 *
 * Renamed rather than deleted, so the original is still recoverable from the
 * browser if something turns out to be missing.
 */
export function archiveLocalData(): void {
  const stamp = new Date().toISOString().slice(0, 10);
  for (const key of Object.values(LEGACY_KEYS)) {
    const value = localStorage.getItem(key);
    if (value === null) continue;
    localStorage.setItem(`${key}.imported-${stamp}`, value);
    localStorage.removeItem(key);
  }
}

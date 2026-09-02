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

import {
  CreditNoteRepo,
  CustomerRepo,
  ExpenseRepo,
  InvoiceRepo,
  PaymentRepo,
  ProductRepo,
  QuotationRepo,
  RecurringRepo,
  SaleRepo,
} from "./accountingRepo";
import type { Invoice, Quotation } from "./accountingStore";
import type { Payment } from "./paymentStore";
import type { Customer } from "./customersStore";
import type { Product } from "./productsStore";
import type { Expense } from "./expenseStore";
import type { Sale } from "./salesStore";
import type { CreditNote } from "./creditNotesStore";
import type { RecurringTemplate } from "./recurringStore";
import {
  DepartmentRepo,
  EmployeeRepo,
  LeaveBalanceRepo,
  LeaveRepo,
  PayrollRepo,
} from "./hrmRepo";
import type { Employee } from "./hrmStore";
import type { Department } from "./hrmDepartmentsStore";
import type { Leave } from "./hrmLeaveStore";
import type { PayrollEntry } from "./payrollStore";
import type { LeaveBalances } from "./leaveBalanceStore";

const LEGACY_KEYS = {
  // Customers were kept under a crm.* key even though the accounting screens
  // used the same store.
  customers: "crm.customers",
  products: "acct.products",
  quotes: "acct.quotes",
  invoices: "acct.invoices",
  payments: "acct.payments",
  expenses: "acct.expenses",
  sales: "acct.sales",
  creditNotes: "acct.credits",
  recurring: "acct.recurring",
  departments: "hrm.departments",
  // The Employees page wrote to its own key, separate from the one the rest of
  // the app read. Both are imported so neither set is stranded.
  employees: "hrm.employees",
  employeesLegacy: "hrm_employees",
  leaves: "hrm.leaves",
  payroll: "hrm.payroll",
} as const;

/** Balances are a single object, not an array, so they are read separately. */
const BALANCES_KEY = "hrm.leaveBalances";

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
  products: number;
  quotations: number;
  invoices: number;
  payments: number;
  expenses: number;
  sales: number;
  creditNotes: number;
  recurring: number;
  departments: number;
  employees: number;
  leaves: number;
  payroll: number;
  leaveBalances: number;
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
    products: readLegacy<Product>(LEGACY_KEYS.products).length,
    quotations: readLegacy<Quotation>(LEGACY_KEYS.quotes).length,
    invoices: readLegacy<Invoice>(LEGACY_KEYS.invoices).length,
    payments: readLegacy<Payment>(LEGACY_KEYS.payments).length,
    expenses: readLegacy<Expense>(LEGACY_KEYS.expenses).length,
    sales: readLegacy<Sale>(LEGACY_KEYS.sales).length,
    creditNotes: readLegacy<CreditNote>(LEGACY_KEYS.creditNotes).length,
    recurring: readLegacy<RecurringTemplate>(LEGACY_KEYS.recurring).length,
    departments: readLegacy<Department>(LEGACY_KEYS.departments).length,
    employees: mergedEmployees().length,
    leaves: readLegacy<Leave>(LEGACY_KEYS.leaves).length,
    payroll: readLegacy<PayrollEntry>(LEGACY_KEYS.payroll).length,
    leaveBalances: Object.keys(readBalances()).length,
  };
}

function readBalances(): LeaveBalances {
  try {
    const raw = localStorage.getItem(BALANCES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as LeaveBalances) : {};
  } catch {
    return {};
  }
}

/** Employees from both keys, the page's own and the shared one, by id. */
function mergedEmployees(): Employee[] {
  const byId = new Map<string, Employee>();
  for (const key of [LEGACY_KEYS.employees, LEGACY_KEYS.employeesLegacy]) {
    for (const e of readLegacy<Employee>(key)) if (e?.id) byId.set(e.id, e);
  }
  return [...byId.values()];
}

export function totalLocalRecords(counts: ImportCounts = findLocalData()): number {
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

export function hasLocalData(): boolean {
  return totalLocalRecords() > 0;
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
    imported: {
      customers: 0,
      products: 0,
      quotations: 0,
      invoices: 0,
      payments: 0,
      expenses: 0,
      sales: 0,
      creditNotes: 0,
      recurring: 0,
      departments: 0,
      employees: 0,
      leaves: 0,
      payroll: 0,
      leaveBalances: 0,
    },
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

  for (const product of readLegacy<Product>(LEGACY_KEYS.products)) {
    try {
      await ProductRepo.upsert(product);
      report.imported.products += 1;
    } catch (err) {
      fail("products", product.id, product.name || product.id, err);
    }
  }

  for (const expense of readLegacy<Expense>(LEGACY_KEYS.expenses)) {
    try {
      await ExpenseRepo.upsert(expense);
      report.imported.expenses += 1;
    } catch (err) {
      fail("expenses", expense.id, expense.vendor || expense.id, err);
    }
  }

  for (const sale of readLegacy<Sale>(LEGACY_KEYS.sales)) {
    try {
      await SaleRepo.upsert(sale);
      report.imported.sales += 1;
    } catch (err) {
      fail("sales", sale.id, sale.number || sale.id, err);
    }
  }

  // Credit notes after invoices: an application resolves to an invoice row and
  // is refused if that invoice is missing.
  for (const creditNote of readLegacy<CreditNote>(LEGACY_KEYS.creditNotes)) {
    try {
      await CreditNoteRepo.upsert(creditNote);
      report.imported.creditNotes += 1;
    } catch (err) {
      fail("creditNotes", creditNote.id, creditNote.number || creditNote.id, err);
    }
  }

  for (const template of readLegacy<RecurringTemplate>(LEGACY_KEYS.recurring)) {
    try {
      await RecurringRepo.upsert(template);
      report.imported.recurring += 1;
    } catch (err) {
      fail("recurring", template.id, template.name || template.id, err);
    }
  }

  // HR, in dependency order: departments, then employees, then everything that
  // references an employee.
  for (const department of readLegacy<Department>(LEGACY_KEYS.departments)) {
    try {
      await DepartmentRepo.upsert(department);
      report.imported.departments += 1;
    } catch (err) {
      fail("departments", department.id, department.name || department.id, err);
    }
  }

  for (const employee of mergedEmployees()) {
    try {
      await EmployeeRepo.upsert(employee);
      report.imported.employees += 1;
    } catch (err) {
      fail("employees", employee.id, employee.name || employee.id, err);
    }
  }

  for (const leaveRequest of readLegacy<Leave>(LEGACY_KEYS.leaves)) {
    try {
      await LeaveRepo.upsert(leaveRequest);
      report.imported.leaves += 1;
    } catch (err) {
      fail("leaves", leaveRequest.id, leaveRequest.employee || leaveRequest.id, err);
    }
  }

  for (const entry of readLegacy<PayrollEntry>(LEGACY_KEYS.payroll)) {
    try {
      await PayrollRepo.upsert(entry);
      report.imported.payroll += 1;
    } catch (err) {
      fail("payroll", entry.id, entry.employee || entry.id, err);
    }
  }

  for (const [employeeId, balances] of Object.entries(readBalances())) {
    try {
      await LeaveBalanceRepo.setForEmployee(employeeId, balances);
      report.imported.leaveBalances += 1;
    } catch (err) {
      fail("leaveBalances", employeeId, employeeId, err);
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
  for (const key of [...Object.values(LEGACY_KEYS), BALANCES_KEY]) {
    const value = localStorage.getItem(key);
    if (value === null) continue;
    localStorage.setItem(`${key}.imported-${stamp}`, value);
    localStorage.removeItem(key);
  }
}

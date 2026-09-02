/**
 * Expenses. Rows in Postgres now, so a claim entered on one machine is visible
 * to whoever approves or reports on it.
 *
 * Receipts are not carried here. They were base64 images inlined into the
 * record; they belong in the expense-receipts storage bucket that the
 * file_storage migration created, which is still to be wired up.
 */

import { createCache } from "./collectionCache";
import { ExpenseRepo } from "./accountingRepo";

export type Expense = {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  currencyCode: string;
  tax?: number; // tax amount
  date: string; // ISO
  notes?: string;
  receiptDataUrl?: string;
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Office",
  "Utilities",
  "Travel",
  "Marketing",
  "Software",
  "Payroll",
  "Taxes",
  "Rent",
  "Insurance",
  "Misc",
];

export const expensesCache = createCache<Expense>(() => ExpenseRepo.list());

export const ExpenseStore = {
  list(): Expense[] {
    return expensesCache.list();
  },
  load(): Promise<Expense[]> {
    return expensesCache.ensureLoaded();
  },
  async add(e: Expense): Promise<Expense> {
    await expensesCache.mutate(() => ExpenseRepo.upsert(e));
    return e;
  },
  async update(e: Expense): Promise<Expense> {
    await expensesCache.mutate(() => ExpenseRepo.upsert(e));
    return e;
  },
  async remove(id: string): Promise<void> {
    await expensesCache.mutate(() => ExpenseRepo.remove(id));
  },
  byCategory(cat: string) {
    return this.list().filter((e) => e.category === cat);
  },
};
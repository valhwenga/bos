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

const KEY = { expenses: "acct.expenses" };

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const ExpenseStore = {
  list(): Expense[] { return read<Expense[]>(KEY.expenses, []); },
  add(e: Expense) { const all = this.list(); all.push(e); write(KEY.expenses, all); return e; },
  update(e: Expense) { const all = this.list(); const i = all.findIndex(x=> x.id===e.id); if (i>=0) all[i]=e; write(KEY.expenses, all); return e; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); write(KEY.expenses, all); },
  byCategory(cat: string) { return this.list().filter(e=> e.category===cat); },
};

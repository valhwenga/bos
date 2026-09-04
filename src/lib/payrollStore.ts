/**
 * Payroll entries.
 *
 * Rows in Postgres now. Salary figures, PAYE and every other deduction were
 * held in localStorage, which meant a payroll run existed only on the machine
 * that produced it and was readable by anything running in that browser. Access
 * is decided by hrm.payroll in row level security.
 *
 * The calculation helpers below are unchanged and stay synchronous; only where
 * the entries live has moved.
 */

import { createCache } from "./collectionCache";
import { PayrollRepo } from "./hrmRepo";

import { CompanySettingsStore } from "./companySettings";

export type PayrollEntry = {
  id: string;
  employeeId: string;
  employee: string;
  department: string;
  basicSalary: number;
  allowances: {
    housing: number;
    transport: number;
    medical: number;
    bonus: number;
    other: number;
  };
  deductions: {
    paye: number; // PAYE tax
    ui: number; // Unemployment Insurance
    pension: number; // Pension fund
    medical: number; // Medical aid
    other: number; // Other deductions
  };
  overtime: {
    hours: number;
    rate: number;
    amount: number;
  };
  netSalary: number;
  paymentDate: string;
  status: "draft" | "pending" | "approved" | "paid";
  createdAt: string;
  notes?: string;
};

export const payrollCache = createCache<PayrollEntry>(() => PayrollRepo.list());

export const PayrollStore = {
  list(): PayrollEntry[] {
    return payrollCache.list();
  },
  load(): Promise<PayrollEntry[]> {
    return payrollCache.ensureLoaded();
  },
  get(id: string): PayrollEntry | undefined {
    return this.list().find((e) => e.id === id);
  },
  async upsert(entry: PayrollEntry): Promise<PayrollEntry> {
    await payrollCache.mutate(() => PayrollRepo.upsert(entry));
    return entry;
  },
  async remove(id: string): Promise<void> {
    await payrollCache.mutate(() => PayrollRepo.remove(id));
  },

  calculateNet(entry: Omit<PayrollEntry, 'netSalary'>): number {
    const totalAllowances = Object.values(entry.allowances).reduce((sum, val) => sum + val, 0);
    const totalDeductions = Object.values(entry.deductions).reduce((sum, val) => sum + val, 0);
    const gross = entry.basicSalary + totalAllowances + entry.overtime.amount;
    return gross - totalDeductions;
  },

  calculateTotals(entry: PayrollEntry) {
    const totalAllowances = Object.values(entry.allowances).reduce((sum, val) => sum + val, 0);
    const totalDeductions = Object.values(entry.deductions).reduce((sum, val) => sum + val, 0);
    const gross = entry.basicSalary + totalAllowances + entry.overtime.amount;
    return {
      basicSalary: entry.basicSalary,
      totalAllowances,
      totalDeductions,
      gross,
      net: gross - totalDeductions
    };
  }
};

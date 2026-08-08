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

const K = { payroll: "hrm.payroll" };

const r = <T,>(k: string, f: T): T => { 
  try { 
    const v = localStorage.getItem(k); 
    return v ? (JSON.parse(v) as T) : f; 
  } catch { 
    return f; 
  } 
};

const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const DEFAULTS: PayrollEntry[] = [
  {
    id: "PAY_001",
    employeeId: "EMP001",
    employee: "John Anderson",
    department: "Engineering",
    basicSalary: 85000,
    allowances: {
      housing: 2000,
      transport: 1500,
      medical: 500,
      bonus: 1000,
      other: 0
    },
    deductions: {
      paye: 8500,
      ui: 300,
      pension: 1200,
      medical: 800,
      other: 0
    },
    overtime: {
      hours: 0,
      rate: 1.5,
      amount: 0
    },
    netSalary: 81500,
    paymentDate: "01 Oct 2025",
    status: "paid",
    createdAt: new Date().toISOString(),
    notes: "Monthly salary with standard deductions"
  }
];

export const PayrollStore = {
  list(): PayrollEntry[] {
    try {
      const data = localStorage.getItem(K.payroll);
      return data ? JSON.parse(data) : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  },

  upsert(entry: PayrollEntry): PayrollEntry {
    const all = this.list();
    const idx = all.findIndex(e => e.id === entry.id);
    const updated = { ...entry, createdAt: entry.createdAt || new Date().toISOString() };
    
    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    
    w(K.payroll, all);
    return updated;
  },

  remove(id: string): void {
    const all = this.list();
    const filtered = all.filter(e => e.id !== id);
    w(K.payroll, filtered);
  },

  get(id: string): PayrollEntry | undefined {
    return this.list().find(e => e.id === id);
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

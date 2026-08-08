/**
 * Per-employee leave balances per leave type.
 * Store format: { employeeId: { leaveType: daysRemaining } }
 */
export type LeaveBalances = Record<string, Record<string, number>>;

const K = { balances: "hrm.leaveBalances" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => {
  try { window.dispatchEvent(new Event(name)); } catch { void 0; }
};

// Default annual balances per type (configurable per company later)
const DEFAULT_BALANCES: Record<string, number> = {
  "Annual Leave": 21,
  "Sick Leave": 10,
  "Maternity Leave": 90,
  "Paternity Leave": 14,
  "Unpaid Leave": 365,
  "Study Leave": 5,
};

export const LeaveBalanceStore = {
  /**
   * Get all balances.
   */
  all(): LeaveBalances {
    return r<LeaveBalances>(K.balances, {});
  },

  /**
   * Get balances for a single employee.
   */
  get(employeeId: string): Record<string, number> {
    const all = this.all();
    return all[employeeId] ?? { ...DEFAULT_BALANCES };
  },

  /**
   * Set balances for an employee (full replace).
   */
  set(employeeId: string, balances: Record<string, number>) {
    const all = this.all();
    all[employeeId] = balances;
    w(K.balances, all);
    emit("hrm.leaveBalances-changed");
  },

  /**
   * Deduct days for a specific leave type on approval.
   */
  deduct(employeeId: string, leaveType: string, days: number) {
    const all = this.all();
    if (!all[employeeId]) {
      all[employeeId] = { ...DEFAULT_BALANCES };
    }
    const current = all[employeeId][leaveType] ?? DEFAULT_BALANCES[leaveType] ?? 0;
    all[employeeId][leaveType] = Math.max(0, current - days);
    w(K.balances, all);
    emit("hrm.leaveBalances-changed");
  },

  /**
   * Add back days (e.g., when a leave is cancelled/rejected after approval).
   */
  add(employeeId: string, leaveType: string, days: number) {
    const all = this.all();
    if (!all[employeeId]) {
      all[employeeId] = { ...DEFAULT_BALANCES };
    }
    const current = all[employeeId][leaveType] ?? DEFAULT_BALANCES[leaveType] ?? 0;
    all[employeeId][leaveType] = current + days;
    w(K.balances, all);
    emit("hrm.leaveBalances-changed");
  },

  /**
   * Initialize default balances for an employee if not present.
   */
  initEmployee(employeeId: string) {
    const all = this.all();
    if (!all[employeeId]) {
      all[employeeId] = { ...DEFAULT_BALANCES };
      w(K.balances, all);
      emit("hrm.leaveBalances-changed");
    }
  },
};

/**
 * Leave balances, per employee and leave type.
 *
 * Rows in Postgres now. Held as one row per employee and type rather than the
 * nested object the app uses, so crediting one balance does not rewrite
 * everyone else's — which is what made the localStorage version unsafe the
 * moment two people were approving leave at once.
 *
 * Reads stay synchronous from a cache; writes are async and go to the server.
 */

import { createCache } from "./collectionCache";
import { LeaveBalanceRepo } from "./hrmRepo";

/**
 * Per-employee leave balances per leave type.
 * Store format: { employeeId: { leaveType: daysRemaining } }
 */
export type LeaveBalances = Record<string, Record<string, number>>;

const DEFAULT_BALANCES: Record<string, number> = {
  "Annual Leave": 21,
  "Sick Leave": 10,
  "Maternity Leave": 90,
  "Paternity Leave": 14,
  "Unpaid Leave": 365,
  "Study Leave": 5,
};

/**
 * The whole map, cached as a single entry. Balances are small and always read
 * together, so one row of state is simpler than a collection.
 */
const balancesCache = createCache<LeaveBalances>(async () => [await LeaveBalanceRepo.all()]);

export { balancesCache as leaveBalancesCache };

const announce = () => {
  try {
    window.dispatchEvent(new Event("hrm.leaveBalances-changed"));
  } catch {
    void 0;
  }
};

export const LeaveBalanceStore = {
  all(): LeaveBalances {
    return balancesCache.list()[0] ?? {};
  },
  load(): Promise<LeaveBalances[]> {
    return balancesCache.ensureLoaded();
  },

  get(employeeId: string): Record<string, number> {
    return this.all()[employeeId] ?? { ...DEFAULT_BALANCES };
  },

  async set(employeeId: string, balances: Record<string, number>): Promise<void> {
    await balancesCache.mutate(() => LeaveBalanceRepo.setForEmployee(employeeId, balances));
    announce();
  },

  /** Deducts days on approval, clamped at zero. */
  async deduct(employeeId: string, leaveType: string, days: number): Promise<void> {
    const current = this.get(employeeId);
    const balance = current[leaveType] ?? DEFAULT_BALANCES[leaveType] ?? 0;
    await this.set(employeeId, { ...current, [leaveType]: Math.max(0, balance - days) });
  },

  /** Adds days back, when approved leave is cancelled or corrected. */
  async add(employeeId: string, leaveType: string, days: number): Promise<void> {
    const current = this.get(employeeId);
    const balance = current[leaveType] ?? DEFAULT_BALANCES[leaveType] ?? 0;
    await this.set(employeeId, { ...current, [leaveType]: balance + days });
  },

  /** Gives a new employee the default allocation, if they have none. */
  async initEmployee(employeeId: string): Promise<void> {
    if (this.all()[employeeId]) return;
    await this.set(employeeId, { ...DEFAULT_BALANCES });
  },
};

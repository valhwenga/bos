/**
 * Leave requests. Rows in Postgres now.
 */

import { createCache } from "./collectionCache";
import { LeaveRepo } from "./hrmRepo";

export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type Leave = {
  id: string;
  employee: string;
  employeeId: string;
  createdByUserId?: string;
  departmentId?: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  managerNote?: string;
};

export const leavesCache = createCache<Leave>(() => LeaveRepo.list());

const announce = () => {
  try {
    window.dispatchEvent(new Event("hrm.leave-changed"));
  } catch {
    void 0;
  }
};

export const HRMLeaveStore = {
  list(): Leave[] {
    return leavesCache.list();
  },
  load(): Promise<Leave[]> {
    return leavesCache.ensureLoaded();
  },
  async upsert(l: Leave): Promise<Leave> {
    await leavesCache.mutate(() => LeaveRepo.upsert(l));
    announce();
    return l;
  },
  async remove(id: string): Promise<void> {
    await leavesCache.mutate(() => LeaveRepo.remove(id));
    announce();
  },
  async setStatus(id: string, status: LeaveStatus, managerNote?: string): Promise<Leave | undefined> {
    const existing = this.list().find((l) => l.id === id);
    if (!existing) return undefined;
    const next = { ...existing, status, managerNote: managerNote ?? existing.managerNote };
    await this.upsert(next);
    return next;
  },
};
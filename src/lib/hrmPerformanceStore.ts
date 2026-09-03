/**
 * Performance reviews. Rows in Postgres now, behind hrm.performance.
 */

import { createCache } from "./collectionCache";
import { PerformanceRepo } from "./supportRepo";

export type PerformanceStatus = "Excellent" | "Good" | "Average" | "Needs Improvement";
export type Performance = {
  id: string;
  employee: string;
  employeeId: string;
  department: string;
  rating: number;
  goalsCompleted: number;
  totalGoals: number;
  attendance: number; // percent
  productivity: number; // percent
  status: PerformanceStatus;
  reviewDate: string; // ISO date
};

export const performanceCache = createCache<Performance>(() => PerformanceRepo.list());

export const HRMPerformanceStore = {
  list(): Performance[] {
    return performanceCache.list();
  },
  load(): Promise<Performance[]> {
    return performanceCache.ensureLoaded();
  },
  async upsert(p: Performance): Promise<Performance> {
    await performanceCache.mutate(() => PerformanceRepo.upsert(p));
    return p;
  },
  async remove(id: string): Promise<void> {
    await performanceCache.mutate(() => PerformanceRepo.remove(id));
  },
};
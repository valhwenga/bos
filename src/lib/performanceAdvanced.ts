/**
 * Advanced performance: OKRs/SMART goals, 360° reviews, calibration.
 *
 * These were the last localStorage store. Three working screens sat on top of
 * it and none of them did what it looked like: a 360° review exists so that
 * several people assess one person and a manager reads them together, and each
 * assessment was held in whichever browser its author happened to use.
 *
 * Who may read what is set out in the migration rather than left to the module
 * gate. Two rules are worth repeating here because the screens depend on them:
 * a peer's review reaches HR and the reviewer, never the person reviewed; and
 * an employee may move the progress on their own goal but not reword it.
 */

import { createCache } from "./collectionCache";
import { GoalRepo, Review360Repo, CalibrationRepo } from "./performanceAdvancedRepo";
export type Goal = {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  category: "objective" | "key_result" | "smart";
  dueDate: string;
  progress: number; // 0-100
  status: "not_started" | "in_progress" | "completed" | "blocked";
  reviewerId?: string;
  reviewerNotes?: string;
};

export type Review360 = {
  id: string;
  employeeId: string;
  reviewerId: string;
  relationship: "manager" | "peer" | "self" | "direct_report";
  ratings: Record<string, number>; // category -> 1-5
  strengths: string[];
  improvements: string[];
  submittedAt: string;
};

export type CalibrationSession = {
  id: string;
  name: string;
  departmentId?: string;
  startDate: string;
  endDate: string;
  participants: string[]; // employeeIds
  finalRatings: Record<string, number>; // employeeId -> final calibrated rating
  notes: Record<string, string>; // employeeId -> calibration notes
};


export const goalsCache = createCache<Goal>(() => GoalRepo.list());
export const reviews360Cache = createCache<Review360>(() => Review360Repo.list());
export const calibrationsCache = createCache<CalibrationSession>(() => CalibrationRepo.list());

export const PerformanceAdvancedStore = {
  // Goals
  listGoals(): Goal[] {
    return goalsCache.list();
  },
  loadGoals(): Promise<Goal[]> {
    return goalsCache.ensureLoaded();
  },
  goalsForEmployee(employeeId: string): Goal[] {
    return this.listGoals().filter((g) => g.employeeId === employeeId);
  },
  async upsertGoal(goal: Goal): Promise<Goal> {
    await goalsCache.mutate(() => GoalRepo.upsert(goal));
    return goal;
  },
  async removeGoal(id: string): Promise<void> {
    await goalsCache.mutate(() => GoalRepo.remove(id));
  },

  // 360 reviews
  list360(): Review360[] {
    return reviews360Cache.list();
  },
  load360(): Promise<Review360[]> {
    return reviews360Cache.ensureLoaded();
  },
  /**
   * Reviews of one person that the caller is allowed to see.
   *
   * For most people that is only their own submission. That is the design, not
   * a gap: candid feedback stops being candid the moment the subject can read
   * it, so what the subject is told is the manager's job rather than this
   * screen's.
   */
  reviewsForEmployee(employeeId: string): Review360[] {
    return this.list360().filter((r) => r.employeeId === employeeId);
  },
  async submit360(review: Review360): Promise<Review360> {
    await reviews360Cache.mutate(() => Review360Repo.submit(review));
    return review;
  },

  // Calibration
  listCalibrations(): CalibrationSession[] {
    return calibrationsCache.list();
  },
  loadCalibrations(): Promise<CalibrationSession[]> {
    return calibrationsCache.ensureLoaded();
  },
  async upsertCalibration(session: CalibrationSession): Promise<CalibrationSession> {
    await calibrationsCache.mutate(() => CalibrationRepo.upsert(session));
    return session;
  },
  async removeCalibration(id: string): Promise<void> {
    await calibrationsCache.mutate(() => CalibrationRepo.remove(id));
  },
};

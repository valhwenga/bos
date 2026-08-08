/**
 * Advanced performance: OKRs/SMART goals, 360° reviews, calibration.
 */
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

const K = { goals: "perf.goals", reviews360: "perf.reviews360", calibrations: "perf.calibrations" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => {
  try { window.dispatchEvent(new Event(name)); } catch { void 0; }
};

export const PerformanceAdvancedStore = {
  // Goals
  listGoals(): Goal[] {
    return r<Goal[]>(K.goals, []);
  },
  upsertGoal(goal: Goal) {
    const all = this.listGoals();
    const i = all.findIndex(g => g.id === goal.id);
    if (i >= 0) all[i] = goal; else all.push(goal);
    w(K.goals, all);
    emit("perf.goals-changed");
    return goal;
  },
  removeGoal(id: string) {
    const all = this.listGoals();
    w(K.goals, all.filter(g => g.id !== id));
    emit("perf.goals-changed");
  },
  goalsForEmployee(employeeId: string): Goal[] {
    return this.listGoals().filter(g => g.employeeId === employeeId);
  },

  // 360 Reviews
  list360(): Review360[] {
    return r<Review360[]>(K.reviews360, []);
  },
  upsert360(review: Review360) {
    const all = this.list360();
    const i = all.findIndex(r => r.id === review.id);
    if (i >= 0) all[i] = review; else all.push(review);
    w(K.reviews360, all);
    emit("perf.reviews360-changed");
    return review;
  },
  reviewsForEmployee(employeeId: string): Review360[] {
    return this.list360().filter(r => r.employeeId === employeeId);
  },

  // Calibration
  listCalibrations(): CalibrationSession[] {
    return r<CalibrationSession[]>(K.calibrations, []);
  },
  upsertCalibration(session: CalibrationSession) {
    const all = this.listCalibrations();
    const i = all.findIndex(s => s.id === session.id);
    if (i >= 0) all[i] = session; else all.push(session);
    w(K.calibrations, all);
    emit("perf.calibrations-changed");
    return session;
  },
  removeCalibration(id: string) {
    const all = this.listCalibrations();
    w(K.calibrations, all.filter(s => s.id !== id));
    emit("perf.calibrations-changed");
  },
};

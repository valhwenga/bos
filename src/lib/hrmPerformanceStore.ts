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

const K = { perf: "hrm.performance" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Performance[] = [
  { id: "PR001", employee: "John Anderson", employeeId: "EMP001", department: "Engineering", rating: 4.5, goalsCompleted: 8, totalGoals: 10, attendance: 95, productivity: 88, status: "Excellent", reviewDate: "2025-10-15" },
  { id: "PR002", employee: "Sarah Williams", employeeId: "EMP002", department: "Marketing", rating: 4.2, goalsCompleted: 7, totalGoals: 10, attendance: 92, productivity: 85, status: "Good", reviewDate: "2025-10-12" },
];

export const HRMPerformanceStore = {
  list(): Performance[] { return r<Performance[]>(K.perf, SEED); },
  upsert(p: Performance) { const all = this.list(); const i = all.findIndex(x=>x.id===p.id); if(i>=0) all[i]=p; else all.push(p); w(K.perf, all); return p; },
  remove(id: string) { const all = this.list().filter(x=> x.id !== id); w(K.perf, all); },
};

export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type Leave = {
  id: string;
  employee: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  managerNote?: string;
};

const K = { leaves: "hrm.leaves" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Leave[] = [
  { id: "L1", employee: "John Anderson", employeeId: "EMP001", type: "Sick Leave", startDate: "2025-10-25", endDate: "2025-10-27", days: 3, reason: "Medical checkup and recovery", status: "Pending", appliedOn: "2025-10-22" },
  { id: "L2", employee: "Sarah Williams", employeeId: "EMP002", type: "Vacation", startDate: "2025-11-01", endDate: "2025-11-10", days: 10, reason: "Family vacation", status: "Approved", appliedOn: "2025-10-15" },
];

export const HRMLeaveStore = {
  list(): Leave[] { return r<Leave[]>(K.leaves, SEED); },
  upsert(l: Leave) { const all = this.list(); const i = all.findIndex(x=>x.id===l.id); if(i>=0) all[i]=l; else all.push(l); w(K.leaves, all); return l; },
  setStatus(id: string, status: LeaveStatus, managerNote?: string) { const all = this.list(); const i = all.findIndex(x=>x.id===id); if(i>=0) { all[i].status = status; if (managerNote) all[i].managerNote = managerNote; w(K.leaves, all); return all[i]; } },
};

export type User = {
  id: string;
  name: string;
  email?: string;
  title?: string;
  department?: string;
  departmentId?: string;
  managedDepartmentIds?: string[];
  avatarDataUrl?: string;
};
export type AttendanceEntry = {
  date: string; // YYYY-MM-DD
  clockIn?: string; // ISO
  clockOut?: string; // ISO
};

const K = { user: "auth.user", attendance: "auth.attendance" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const DEFAULT_USER: User = { id: "u_1", name: "User" };

function today(): string { return new Date().toISOString().slice(0,10); }

export const UserStore = {
  get(): User { return r<User>(K.user, DEFAULT_USER); },
  set(u: User) { w(K.user, u); return u; },
  update(patch: Partial<User>) { const cur = this.get(); const next = { ...cur, ...patch }; return this.set(next); },
  attendance(): AttendanceEntry[] { return r<AttendanceEntry[]>(K.attendance, []); },
  setAttendance(a: AttendanceEntry[]) { w(K.attendance, a); return a; },
  clockIn() {
    const date = today();
    const all = this.attendance();
    const i = all.findIndex(e => e.date === date);
    if (i >= 0) {
      if (!all[i].clockIn) all[i].clockIn = new Date().toISOString();
    } else {
      all.push({ date, clockIn: new Date().toISOString() });
    }
    this.setAttendance(all);
  },
  clockOut() {
    const date = today();
    const all = this.attendance();
    const i = all.findIndex(e => e.date === date);
    if (i >= 0) {
      all[i].clockOut = new Date().toISOString();
    } else {
      all.push({ date, clockOut: new Date().toISOString() });
    }
    this.setAttendance(all);
  },
  todayStatus(): AttendanceEntry | undefined { return this.attendance().find(e => e.date === today()); },
};

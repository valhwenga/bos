/**
 * The signed-in user's local profile, and attendance.
 *
 * Attendance is in Postgres: it was per browser, which made it useless as a
 * record — signing in on a second machine started a separate day, and nobody
 * but that person could see any of it. A person now sees their own days and HR
 * sees everyone's.
 *
 * The display preferences below stay local on purpose. They are per-device
 * conveniences, not company data.
 */

import { AttendanceRepo } from "./hrmRepo";
import { createCache } from "./collectionCache";

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

export const attendanceCache = createCache<AttendanceEntry>(async () =>
  (await AttendanceRepo.list()).map((row) => ({
    date: row.date,
    clockIn: row.clockIn,
    clockOut: row.clockOut,
  })),
);

export const UserStore = {
  get(): User {
    return r<User>(K.user, DEFAULT_USER);
  },
  set(u: User) {
    w(K.user, u);
    return u;
  },
  update(patch: Partial<User>) {
    return this.set({ ...this.get(), ...patch });
  },

  attendance(): AttendanceEntry[] {
    return attendanceCache.list();
  },
  loadAttendance(): Promise<AttendanceEntry[]> {
    return attendanceCache.ensureLoaded();
  },

  async clockIn(): Promise<void> {
    await attendanceCache.mutate(() => AttendanceRepo.clockIn());
  },
  async clockOut(): Promise<void> {
    await attendanceCache.mutate(() => AttendanceRepo.clockOut());
  },

  todayStatus(): AttendanceEntry | undefined {
    return this.attendance().find((e) => e.date === today());
  },
};

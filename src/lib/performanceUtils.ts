import { UserStore, type AttendanceEntry } from "./userStore";
import { HRMLeaveStore, type Leave } from "./hrmLeaveStore";

/**
 * Compute attendance % for a given employee and month.
 * Rules:
 * - Period: month of reviewDate
 * - Working days: Monday–Friday only
 * - Present: any clockIn on a working day
 * - Exclude approved leave days from expected working days
 */
export function computeAttendancePercent(employeeId: string, reviewDate: string): {
  attendancePercent: number;
  presentDays: number;
  expectedWorkingDays: number;
  approvedLeaveDays: number;
  breakdown: string[];
} {
  // Parse month/year from reviewDate (YYYY-MM-DD)
  const review = new Date(reviewDate);
  const year = review.getFullYear();
  const month = review.getMonth(); // 0-indexed

  // Helper: is a date Monday–Friday?
  const isWeekday = (d: Date) => {
    const day = d.getDay();
    return day >= 1 && day <= 5; // 1=Mon, 5=Fri
  };

  // Helper: format date as YYYY-MM-DD
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Compute all working days (Mon–Fri) in the month
  const workingDaysInMonth: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    if (isWeekday(d)) {
      workingDaysInMonth.push(fmt(d));
    }
  }

  // Get approved leave days for this employee in the month
  const allLeaves = HRMLeaveStore.list();
  const approvedLeaves = allLeaves.filter(
    (l) => l.employeeId === employeeId && l.status === "Approved"
  );
  const approvedLeaveDates = new Set<string>();
  for (const leave of approvedLeaves) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === year && d.getMonth() === month && isWeekday(d)) {
        approvedLeaveDates.add(fmt(d));
      }
    }
  }

  // Expected working days = working days - approved leave days
  const expectedWorkingDays = workingDaysInMonth.length - approvedLeaveDates.size;
  if (expectedWorkingDays <= 0) {
    return {
      attendancePercent: 0,
      presentDays: 0,
      expectedWorkingDays: 0,
      approvedLeaveDays: approvedLeaveDates.size,
      breakdown: ["No expected working days (all days are approved leave)"],
    };
  }

  // Attendance entries for this employee (Note: current UserStore is per-user; if you extend to per-employee, adjust here)
  // For now, we assume attendance is stored globally per user; if you have per-employee attendance, adapt accordingly.
  const attendance = UserStore.attendance();

  // Count present days: any clockIn on a working day (excluding approved leave days)
  let presentDays = 0;
  for (const dateStr of workingDaysInMonth) {
    if (approvedLeaveDates.has(dateStr)) continue; // skip approved leave days
    const entry = attendance.find((e) => e.date === dateStr);
    if (entry && entry.clockIn) {
      presentDays++;
    }
  }

  const attendancePercent = Math.round((presentDays / expectedWorkingDays) * 100);

  // Build breakdown for UI display
  const breakdown: string[] = [];
  breakdown.push(`Working days (Mon–Fri): ${workingDaysInMonth.length}`);
  breakdown.push(`Approved leave days: ${approvedLeaveDates.size}`);
  breakdown.push(`Expected working days: ${expectedWorkingDays}`);
  breakdown.push(`Present days (any clock-in): ${presentDays}`);
  breakdown.push(`Attendance %: ${attendancePercent}%`);

  return {
    attendancePercent,
    presentDays,
    expectedWorkingDays,
    approvedLeaveDays: approvedLeaveDates.size,
    breakdown,
  };
}

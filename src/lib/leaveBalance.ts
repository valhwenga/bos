import { isPublicHoliday } from "./holidays";
import { HRMLeaveStore, type Leave } from "./hrmLeaveStore";
import { CompanySettingsStore } from "./companySettingsStore";

/**
 * Calculate working days in a date range, excluding weekends and public holidays.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const company = CompanySettingsStore.get();
  const country = company.country as keyof typeof import("./holidays").PUBLIC_HOLIDAYS;
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5 && !isPublicHoliday(d.toISOString().slice(0, 10), country)) {
      count++;
    }
  }
  return count;
}

/**
 * Update leave balances based on approved leave requests.
 * This is a placeholder for a real leave balance engine.
 * In production, you’d store per‑employee balances per leave type.
 */
export function updateLeaveBalances(employeeId: string): Record<string, number> {
  const leaves = HRMLeaveStore.list().filter(l => l.employeeId === employeeId && l.status === "Approved");
  // Example: deduct days from a running balance per leave type
  // For now, just return a summary for UI display
  const summary: Record<string, number> = {};
  for (const leave of leaves) {
    const workingDays = countWorkingDays(leave.startDate, leave.endDate);
    summary[leave.type] = (summary[leave.type] || 0) + workingDays;
  }
  return summary;
}

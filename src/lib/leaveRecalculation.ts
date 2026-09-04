/**
 * One-off correction for leave requests costed against the old holiday list.
 *
 * PUBLIC_HOLIDAYS only covered 2025, and countWorkingDays consults it when
 * costing a request. From 1 January 2026 every public holiday was therefore
 * counted as a working day, so leave spanning one was over-charged — and, once
 * approved, over-deducted from the employee's balance.
 *
 * The audit is read-only. Nothing is written until applyCorrections is called,
 * because silently rewriting approved leave records is not something this
 * should do on its own.
 */

import { HRMLeaveStore, type Leave } from "./hrmLeaveStore";
import { LeaveBalanceStore } from "./leaveBalanceStore";
import { countWorkingDays } from "./leaveBalance";
import { isPublicHoliday, publicHolidays } from "./holidays";

export type LeaveCorrection = {
  leave: Leave;
  storedDays: number;
  correctDays: number;
  /** Positive means the employee was charged too much. */
  difference: number;
  /** The holidays that were wrongly counted as working days. */
  missedHolidays: { date: string; name: string }[];
  /** Approved leave also moved the balance, so it needs crediting back. */
  affectsBalance: boolean;
};

export type CorrectionReport = {
  corrections: LeaveCorrection[];
  totalDaysOwed: number;
  employeesAffected: number;
  /**
   * Balances that already sit at zero. deduct() clamps at zero, so days beyond
   * that point were lost and cannot be derived — these need a human to set the
   * correct figure.
   */
  clampedBalances: { employeeId: string; employeeName: string; leaveType: string }[];
};

/** Public holidays falling on a weekday within a range, with their names. */
function weekdayHolidaysBetween(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const byDate = new Map<string, string>();
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    for (const holiday of publicHolidays(year)) byDate.set(holiday.date, holiday.name);
  }

  const found: { date: string; name: string }[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) continue; // a weekend was never charged anyway
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (isPublicHoliday(iso)) found.push({ date: iso, name: byDate.get(iso) ?? "Public holiday" });
  }
  return found;
}

/**
 * Compares every stored leave request against a recount using the corrected
 * holiday calendar. Read-only.
 */
export function auditLeaveDays(): CorrectionReport {
  const corrections: LeaveCorrection[] = [];

  for (const leave of HRMLeaveStore.list()) {
    if (!leave.startDate || !leave.endDate) continue;

    const correctDays = countWorkingDays(leave.startDate, leave.endDate);
    const storedDays = Number(leave.days) || 0;
    if (correctDays === storedDays) continue;

    corrections.push({
      leave,
      storedDays,
      correctDays,
      difference: storedDays - correctDays,
      missedHolidays: weekdayHolidaysBetween(leave.startDate, leave.endDate),
      affectsBalance: leave.status === "Approved",
    });
  }

  // A balance sitting at zero may have been clamped by deduct(), in which case
  // the true figure cannot be recovered by crediting a difference.
  const clampedBalances: CorrectionReport["clampedBalances"] = [];
  for (const c of corrections) {
    if (!c.affectsBalance || c.difference <= 0) continue;
    const balance = LeaveBalanceStore.get(c.leave.employeeId)[c.leave.type];
    if (balance === 0) {
      clampedBalances.push({
        employeeId: c.leave.employeeId,
        employeeName: c.leave.employee,
        leaveType: c.leave.type,
      });
    }
  }

  return {
    corrections,
    totalDaysOwed: corrections.reduce((sum, c) => sum + Math.max(0, c.difference), 0),
    employeesAffected: new Set(corrections.map((c) => c.leave.employeeId)).size,
    clampedBalances,
  };
}

export type ApplyResult = {
  leavesUpdated: number;
  daysCredited: number;
  employeesCredited: number;
};

/**
 * Writes the corrected day counts and credits balances back.
 *
 * Only approved leave moves a balance, so only those are credited. Rejected and
 * pending requests have their day count corrected but no balance effect.
 *
 * Safe to run twice: a second pass finds nothing to correct, because the audit
 * compares stored against recomputed rather than tracking that it has run.
 */
export async function applyCorrections(report: CorrectionReport): Promise<ApplyResult> {
  let leavesUpdated = 0;
  let daysCredited = 0;
  const credited = new Set<string>();

  for (const c of report.corrections) {
    await HRMLeaveStore.upsert({ ...c.leave, days: c.correctDays });
    leavesUpdated += 1;

    if (!c.affectsBalance || c.difference === 0) continue;

    if (c.difference > 0) {
      // Over-charged: give the days back.
      await LeaveBalanceStore.add(c.leave.employeeId, c.leave.type, c.difference);
      daysCredited += c.difference;
    } else {
      // Under-charged, which can happen if a request was edited by hand.
      await LeaveBalanceStore.deduct(c.leave.employeeId, c.leave.type, -c.difference);
    }
    credited.add(c.leave.employeeId);
  }

  return { leavesUpdated, daysCredited, employeesCredited: credited.size };
}

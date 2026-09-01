import { describe, it, expect, beforeEach } from "vitest";
import { auditLeaveDays, applyCorrections } from "./leaveRecalculation";
import { HRMLeaveStore, type Leave } from "./hrmLeaveStore";
import { LeaveBalanceStore } from "./leaveBalanceStore";

/**
 * Minimal localStorage so the stores work under Node.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const leave = (over: Partial<Leave> = {}): Leave => ({
  id: "L1",
  employee: "Jane Doe",
  employeeId: "E1",
  type: "Annual Leave",
  startDate: "2026-06-15",
  endDate: "2026-06-19",
  days: 5, // charged as if Youth Day (16 June) were a working day
  reason: "Family",
  status: "Approved",
  appliedOn: "2026-06-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
  (globalThis as unknown as { window: { dispatchEvent: () => boolean; addEventListener: () => void } }).window = {
    dispatchEvent: () => true,
    addEventListener: () => undefined,
  };
  // HRMLeaveStore falls back to a two-record SEED when the key is absent, which
  // would otherwise appear in every fixture.
  localStorage.setItem("hrm.leaves", "[]");
});

describe("auditLeaveDays", () => {
  it("finds a request that was charged for a public holiday", () => {
    HRMLeaveStore.upsert(leave());

    const report = auditLeaveDays();
    expect(report.corrections).toHaveLength(1);

    const [correction] = report.corrections;
    // Mon 15 to Fri 19 June 2026 is five weekdays, but 16 June is Youth Day.
    expect(correction.storedDays).toBe(5);
    expect(correction.correctDays).toBe(4);
    expect(correction.difference).toBe(1);
    expect(correction.missedHolidays.map((h) => h.name)).toContain("Youth Day");
  });

  it("reports nothing when the day counts are already right", () => {
    HRMLeaveStore.upsert(leave({ days: 4 }));
    expect(auditLeaveDays().corrections).toHaveLength(0);
  });

  it("changes nothing on its own", () => {
    HRMLeaveStore.upsert(leave());
    auditLeaveDays();
    expect(HRMLeaveStore.list()[0].days).toBe(5);
  });

  it("counts affected employees rather than requests", () => {
    HRMLeaveStore.upsert(leave({ id: "L1" }));
    HRMLeaveStore.upsert(leave({ id: "L2", startDate: "2026-12-24", endDate: "2026-12-25", days: 2 }));
    const report = auditLeaveDays();
    expect(report.corrections.length).toBe(2);
    expect(report.employeesAffected).toBe(1);
  });
});

describe("applyCorrections", () => {
  it("writes the corrected day count", () => {
    HRMLeaveStore.upsert(leave());
    applyCorrections(auditLeaveDays());
    expect(HRMLeaveStore.list()[0].days).toBe(4);
  });

  it("credits the balance back for approved leave", () => {
    HRMLeaveStore.upsert(leave({ status: "Approved" }));
    LeaveBalanceStore.set("E1", { "Annual Leave": 16 }); // 21 less the 5 charged

    const result = applyCorrections(auditLeaveDays());

    expect(result.daysCredited).toBe(1);
    expect(LeaveBalanceStore.get("E1")["Annual Leave"]).toBe(17);
  });

  it("does not touch balances for pending leave, which never moved one", () => {
    HRMLeaveStore.upsert(leave({ status: "Pending" }));
    LeaveBalanceStore.set("E1", { "Annual Leave": 21 });

    const result = applyCorrections(auditLeaveDays());

    expect(result.leavesUpdated).toBe(1);
    expect(result.daysCredited).toBe(0);
    expect(LeaveBalanceStore.get("E1")["Annual Leave"]).toBe(21);
  });

  it("is idempotent: running twice does not credit twice", () => {
    HRMLeaveStore.upsert(leave());
    LeaveBalanceStore.set("E1", { "Annual Leave": 16 });

    applyCorrections(auditLeaveDays());
    const afterFirst = LeaveBalanceStore.get("E1")["Annual Leave"];

    const second = auditLeaveDays();
    expect(second.corrections).toHaveLength(0);
    applyCorrections(second);

    expect(LeaveBalanceStore.get("E1")["Annual Leave"]).toBe(afterFirst);
  });

  it("flags a balance already clamped at zero, where the loss cannot be derived", () => {
    HRMLeaveStore.upsert(leave());
    // deduct() stops at zero, so days beyond that point are unrecoverable.
    LeaveBalanceStore.set("E1", { "Annual Leave": 0 });

    const report = auditLeaveDays();
    expect(report.clampedBalances).toHaveLength(1);
    expect(report.clampedBalances[0].employeeName).toBe("Jane Doe");
  });
});

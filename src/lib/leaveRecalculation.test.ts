import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Leave } from "./hrmLeaveStore";
import type { LeaveBalances } from "./leaveBalanceStore";

/**
 * The stores are Postgres-backed now, so these tests stand in for the database
 * rather than for localStorage. Mocking the repository — the one module that
 * talks to Supabase — exercises the real stores, the real cache and the real
 * recalculation logic, and only fakes the round trip.
 */

const db: { leaves: Leave[]; balances: LeaveBalances } = { leaves: [], balances: {} };

vi.mock("./hrmRepo", () => ({
  LeaveRepo: {
    list: async () => db.leaves.map((l) => ({ ...l })),
    upsert: async (l: Leave) => {
      const i = db.leaves.findIndex((x) => x.id === l.id);
      if (i >= 0) db.leaves[i] = { ...l };
      else db.leaves.push({ ...l });
      return l;
    },
    remove: async (id: string) => {
      db.leaves = db.leaves.filter((x) => x.id !== id);
    },
  },
  LeaveBalanceRepo: {
    all: async () => JSON.parse(JSON.stringify(db.balances)) as LeaveBalances,
    setForEmployee: async (employeeId: string, balances: Record<string, number>) => {
      db.balances[employeeId] = { ...balances };
    },
  },
  // The recalculation does not use these, but the module exports them.
  DepartmentRepo: { list: async () => [] },
  EmployeeRepo: { list: async () => [] },
  PayrollRepo: { list: async () => [] },
}));

const { auditLeaveDays, applyCorrections } = await import("./leaveRecalculation");
const { HRMLeaveStore, leavesCache } = await import("./hrmLeaveStore");
const { LeaveBalanceStore, leaveBalancesCache } = await import("./leaveBalanceStore");

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

/** Puts rows straight into the fake database and loads them into the caches. */
async function given(leaves: Leave[], balances: LeaveBalances = {}) {
  db.leaves = leaves.map((l) => ({ ...l }));
  db.balances = JSON.parse(JSON.stringify(balances));
  await Promise.all([leavesCache.refresh(), leaveBalancesCache.refresh()]);
}

beforeEach(async () => {
  await given([]);
});

describe("auditLeaveDays", () => {
  it("finds a request that was charged for a public holiday", async () => {
    await given([leave()]);

    const report = auditLeaveDays();
    expect(report.corrections).toHaveLength(1);

    const [correction] = report.corrections;
    // Mon 15 to Fri 19 June 2026 is five weekdays, but 16 June is Youth Day.
    expect(correction.storedDays).toBe(5);
    expect(correction.correctDays).toBe(4);
    expect(correction.difference).toBe(1);
    expect(correction.missedHolidays.map((h) => h.name)).toContain("Youth Day");
  });

  it("reports nothing when the day counts are already right", async () => {
    await given([leave({ days: 4 })]);
    expect(auditLeaveDays().corrections).toHaveLength(0);
  });

  it("changes nothing on its own", async () => {
    await given([leave()]);
    auditLeaveDays();
    expect(HRMLeaveStore.list()[0].days).toBe(5);
    expect(db.leaves[0].days).toBe(5);
  });

  it("counts affected employees rather than requests", async () => {
    await given([
      leave({ id: "L1" }),
      leave({ id: "L2", startDate: "2026-12-24", endDate: "2026-12-25", days: 2 }),
    ]);
    const report = auditLeaveDays();
    expect(report.corrections.length).toBe(2);
    expect(report.employeesAffected).toBe(1);
  });
});

describe("applyCorrections", () => {
  it("writes the corrected day count", async () => {
    await given([leave()]);
    await applyCorrections(auditLeaveDays());
    expect(HRMLeaveStore.list()[0].days).toBe(4);
  });

  it("credits the balance back for approved leave", async () => {
    // 21 less the 5 charged.
    await given([leave({ status: "Approved" })], { E1: { "Annual Leave": 16 } });

    const result = await applyCorrections(auditLeaveDays());

    expect(result.daysCredited).toBe(1);
    expect(LeaveBalanceStore.get("E1")["Annual Leave"]).toBe(17);
  });

  it("does not touch balances for pending leave, which never moved one", async () => {
    await given([leave({ status: "Pending" })], { E1: { "Annual Leave": 21 } });

    const result = await applyCorrections(auditLeaveDays());

    expect(result.leavesUpdated).toBe(1);
    expect(result.daysCredited).toBe(0);
    expect(LeaveBalanceStore.get("E1")["Annual Leave"]).toBe(21);
  });

  it("is idempotent: running twice does not credit twice", async () => {
    await given([leave()], { E1: { "Annual Leave": 16 } });

    await applyCorrections(auditLeaveDays());
    const afterFirst = LeaveBalanceStore.get("E1")["Annual Leave"];

    const second = auditLeaveDays();
    expect(second.corrections).toHaveLength(0);
    await applyCorrections(second);

    expect(LeaveBalanceStore.get("E1")["Annual Leave"]).toBe(afterFirst);
  });

  it("flags a balance already clamped at zero, where the loss cannot be derived", async () => {
    // deduct() stops at zero, so days beyond that point are unrecoverable.
    await given([leave()], { E1: { "Annual Leave": 0 } });

    const report = auditLeaveDays();
    expect(report.clampedBalances).toHaveLength(1);
    expect(report.clampedBalances[0].employeeName).toBe("Jane Doe");
  });
});

import { describe, it, expect } from "vitest";
import { computeTax } from "./taxEngine";

/**
 * These assert properties that must hold for any progressive tax system,
 * rather than pinning today's output. A test that only records what the code
 * currently returns would pass just as happily with the brackets wrong.
 */

describe("computeTax (South Africa)", () => {
  const country = "ZA" as const;
  it("charges nothing on zero income", () => {
    const result = computeTax(0, country);
    expect(result.incomeTax).toBe(0);
    expect(result.totalDeductions).toBe(0);
    expect(result.netPay).toBe(0);
  });

  it("never returns more net pay than gross", () => {
    for (const gross of [1_000, 50_000, 250_000, 1_000_000]) {
      expect(computeTax(gross, country).netPay).toBeLessThanOrEqual(gross);
    }
  });

  it("never leaves an employee with negative pay", () => {
    for (const gross of [1_000, 25_000, 100_000, 500_000]) {
      expect(computeTax(gross, country).netPay).toBeGreaterThan(0);
    }
  });

  it("is monotonic: earning more never reduces the tax owed", () => {
    let previous = -1;
    for (let gross = 0; gross <= 400_000; gross += 10_000) {
      const tax = computeTax(gross, country).incomeTax;
      expect(tax).toBeGreaterThanOrEqual(previous);
      previous = tax;
    }
  });

  it("never taxes an extra rand more than it is worth (marginal rate below 100%)", () => {
    // A raise must always leave the employee better off.
    let previousNet = -Infinity;
    for (let gross = 0; gross <= 800_000; gross += 5_000) {
      const net = computeTax(gross, country).netPay;
      expect(net).toBeGreaterThanOrEqual(previousNet);
      previousNet = net;
    }
  });

  it("keeps deductions consistent with net pay", () => {
    const gross = 120_000;
    const r = computeTax(gross, country);
    expect(r.netPay).toBeCloseTo(gross - r.totalDeductions, 6);
  });
});

describe("South Africa statutory caps", () => {
  it("caps UIF regardless of salary", () => {
    const high = computeTax(5_000_000, "ZA");
    const modest = computeTax(200_000, "ZA");
    expect(high.statutoryDeductions.uif).toBeLessThanOrEqual(2476.8);
    expect(modest.statutoryDeductions.uif).toBeLessThanOrEqual(2476.8);
  });

  it("charges SDL at one percent of gross", () => {
    expect(computeTax(500_000, "ZA").statutoryDeductions.sdl).toBeCloseTo(5_000, 6);
  });
});

describe("single tax engine", () => {
  it("rejects a country it does not implement rather than guessing", () => {
    // CA, AU, DE and FR previously fell through to a flat 20% placeholder that
    // was returned as though it were a real calculation.
    expect(() => computeTax(100_000, "US" as unknown as "ZA")).toThrow(/not implemented/);
  });

  it("treats a negative gross as zero rather than refunding tax", () => {
    const r = computeTax(-50_000);
    expect(r.incomeTax).toBe(0);
    expect(r.netPay).toBe(0);
  });

  it("defaults to South Africa when no country is given", () => {
    expect(computeTax(500_000)).toEqual(computeTax(500_000, "ZA"));
  });
});

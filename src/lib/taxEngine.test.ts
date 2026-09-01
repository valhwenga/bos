import { describe, it, expect } from "vitest";
import { computeTax, type TaxCountry } from "./taxEngine";
import { computeTaxUS, TAX_BRACKETS_US } from "./payrollAdvanced";

/**
 * These assert properties that must hold for any progressive tax system,
 * rather than pinning today's output. A test that only records what the code
 * currently returns would pass just as happily with the brackets wrong.
 */

const COUNTRIES: TaxCountry[] = ["US", "GB", "ZA"];

describe.each(COUNTRIES)("computeTax(%s)", (country) => {
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

  it("never taxes an extra pound more than it is worth (marginal rate below 100%)", () => {
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

describe("United States statutory caps", () => {
  it("caps social security contributions", () => {
    const high = computeTax(2_000_000, "US");
    expect(high.statutoryDeductions.socialSecurity).toBeLessThanOrEqual(11_700);
  });

  it("charges medicare on the full amount", () => {
    expect(computeTax(100_000, "US").statutoryDeductions.medicare).toBeCloseTo(1_450, 6);
  });
});

describe("bracket tables", () => {
  it("US brackets are contiguous and ascending", () => {
    for (let i = 1; i < TAX_BRACKETS_US.length; i++) {
      const previous = TAX_BRACKETS_US[i - 1];
      const current = TAX_BRACKETS_US[i];
      expect(previous.max).not.toBeNull();
      // Each band must start where the previous one ended.
      expect(current.min).toBe((previous.max as number) + 1);
      expect(current.rate).toBeGreaterThan(previous.rate);
    }
  });
});

/**
 * There are two independent US tax tables in the codebase — taxEngine.ts drives
 * computeTax('US') and payrollAdvanced.ts drives computeTaxUS(). They disagree,
 * so the figure an employee sees depends on which module a page imported.
 *
 * This test documents the discrepancy rather than asserting either is correct;
 * which brackets are right is a tax question. When the tables are reconciled
 * this should be changed to assert the two agree.
 */
describe("known defect: two disagreeing US tax tables", () => {
  it("produces different tax for the same salary", () => {
    const gross = 60_000;
    const viaTaxEngine = computeTax(gross, "US").incomeTax;
    const viaPayrollAdvanced = computeTaxUS(gross);

    // Fails once the tables are reconciled, which is the point: it will force
    // this test to be updated rather than letting the conflict persist quietly.
    expect(viaTaxEngine).not.toBeCloseTo(viaPayrollAdvanced, 2);
  });
});

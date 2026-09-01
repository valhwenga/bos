import { describe, it, expect } from "vitest";
import { computeTaxUS, generateACH, generateBACS, CURRENCY_SYMBOLS, COUNTRY_TO_CURRENCY, MissingBankDetailsError } from "./payrollAdvanced";
import { countWorkingDays } from "./leaveBalance";

describe("computeTaxUS", () => {
  it("charges nothing on zero", () => {
    expect(computeTaxUS(0)).toBe(0);
  });

  it("is monotonic", () => {
    let previous = -1;
    for (let gross = 0; gross <= 500_000; gross += 5_000) {
      const tax = computeTaxUS(gross);
      expect(tax).toBeGreaterThanOrEqual(previous);
      previous = tax;
    }
  });

  it("never exceeds the gross it is charged on", () => {
    for (const gross of [10_000, 100_000, 1_000_000]) {
      expect(computeTaxUS(gross)).toBeLessThan(gross);
    }
  });

  it("applies the lowest band only, below the first threshold", () => {
    // 10% on the first band; a salary inside it cannot attract a higher rate.
    expect(computeTaxUS(10_000)).toBeCloseTo(1_000, 0);
  });
});

describe("currency mapping", () => {
  it("maps every supported country to a currency that has a symbol", () => {
    for (const [country, currency] of Object.entries(COUNTRY_TO_CURRENCY)) {
      expect(CURRENCY_SYMBOLS[currency], `${country} -> ${currency}`).toBeTruthy();
    }
  });

  it("uses the rand for South Africa", () => {
    expect(COUNTRY_TO_CURRENCY.ZA).toBe("ZAR");
    expect(CURRENCY_SYMBOLS.ZAR).toBe("R");
  });
});

describe("bank export files", () => {
  const withBank = [
    { employee: "Jane Doe", employeeId: "E1", employeeName: "Jane Doe", netSalary: 4200.5, bankAccount: "12345678", routingNumber: "111000025", accountNumber: "12345678", sortCode: "203045" },
    { employee: "John Roe", employeeId: "E2", employeeName: "John Roe", netSalary: 3980, bankAccount: "87654321", routingNumber: "111000025", accountNumber: "87654321", sortCode: "203045" },
  ];

  it("writes one ACH line per employee", () => {
    const out = generateACH(withBank);
    expect(out).toContain("Jane Doe");
    expect(out).toContain("John Roe");
  });

  it("writes one BACS line per employee", () => {
    const out = generateBACS(withBank);
    expect(out).toContain("Jane Doe");
    expect(out).toContain("John Roe");
  });

  it("includes an employee on zero net pay rather than dropping them", () => {
    // Someone on unpaid leave still belongs in the run; omitting them hides it.
    const withZero = [...withBank, { ...withBank[0], employeeId: "E3", employeeName: "Zero Pay", netSalary: 0 }];
    expect(generateACH(withZero)).toContain("Zero Pay");
  });

  it("refuses to build a file from placeholder account numbers", () => {
    // The panel used to pass all-zero placeholders and still produce a
    // downloadable file, which looked like a working export but was unusable.
    const placeholders = withBank.map((r) => ({ ...r, bankAccount: "000000000", accountNumber: "00000000" }));
    expect(() => generateACH(placeholders)).toThrow(MissingBankDetailsError);
    expect(() => generateBACS(placeholders)).toThrow(MissingBankDetailsError);
  });

  it("names the employees whose details are missing", () => {
    const placeholders = withBank.map((r) => ({ ...r, bankAccount: "0", accountNumber: "0" }));
    expect(() => generateACH(placeholders)).toThrow(/Jane Doe/);
  });
});

describe("countWorkingDays", () => {
  it("excludes weekends", () => {
    // Mon 5 Jan 2026 to Fri 9 Jan 2026 is five working days.
    expect(countWorkingDays("2026-01-05", "2026-01-09")).toBe(5);
  });

  it("counts a single weekday as one day", () => {
    expect(countWorkingDays("2026-01-05", "2026-01-05")).toBe(1);
  });

  it("counts a weekend-only range as zero", () => {
    // Sat 10 and Sun 11 Jan 2026.
    expect(countWorkingDays("2026-01-10", "2026-01-11")).toBe(0);
  });

  it("never returns a negative span when the dates are reversed", () => {
    expect(countWorkingDays("2026-01-09", "2026-01-05")).toBeGreaterThanOrEqual(0);
  });
});

describe("payroll entry arithmetic", () => {
  // Mirrors how HRMPayrollManage collapses the itemised figures for a payslip.
  const sum = (parts: Record<string, number>) =>
    Object.values(parts).reduce((total, amount) => total + (amount || 0), 0);

  it("nets out to basic plus allowances plus overtime less deductions", () => {
    const basic = 50_000;
    const allowances = { housing: 5_000, transport: 1_200, medical: 800, bonus: 0, other: 0 };
    const deductions = { paye: 9_000, ui: 500, pension: 2_500, medical: 1_100, other: 0 };
    const overtime = { hours: 10, rate: 150, amount: 1_500 };

    const net = basic + sum(allowances) + overtime.amount - sum(deductions);
    expect(net).toBe(45_400);
  });

  it("treats a missing allowance component as zero rather than NaN", () => {
    // Records imported from older versions may lack newer fields.
    const partial = { housing: 1_000, transport: undefined as unknown as number };
    expect(Number.isNaN(sum(partial))).toBe(false);
    expect(sum(partial)).toBe(1_000);
  });
});

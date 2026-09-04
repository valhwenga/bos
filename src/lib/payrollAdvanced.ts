/**
 * Payroll utilities: currency formatting and bank export.
 *
 * The US bracket table and computeTaxUS() were removed. They duplicated — and
 * disagreed with — the brackets in taxEngine.ts, so the figure an employee saw
 * depended on which module a page imported. South African PAYE lives in
 * taxEngine.ts and is now the only tax calculation.
 */

export type Currency = "ZAR";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ZAR: "R",
};

/** Retained so callers reading a stored country setting still resolve. */
export const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  ZA: "ZAR",
};

/**
 * Refuses to build a payment file from placeholder bank details.
 *
 * The export previously filled every account number with zeros and still
 * produced a downloadable file, so it looked like a working payroll export
 * while being unusable — or worse, ambiguous — if submitted to a bank.
 * Employee bank details are not captured anywhere yet, so the honest behaviour
 * is to fail and say which employees are missing them.
 */
export class MissingBankDetailsError extends Error {
  constructor(readonly employees: string[]) {
    super(
      `Cannot build a bank file: no account details for ${employees.length} ` +
        `employee${employees.length === 1 ? "" : "s"} (${employees.slice(0, 3).join(", ")}` +
        `${employees.length > 3 ? ", …" : ""}). Add their bank details first.`,
    );
    this.name = "MissingBankDetailsError";
  }
}

const isPlaceholder = (value?: string) => !value || /^0+$/.test(value.trim());

function assertBankDetails(
  rows: Array<{ employeeName: string; bankAccount?: string; accountNumber?: string }>,
) {
  const missing = rows
    .filter((r) => isPlaceholder(r.bankAccount) && isPlaceholder(r.accountNumber))
    .map((r) => r.employeeName || "(unnamed)");
  if (missing.length) throw new MissingBankDetailsError(missing);
}

/**
 * Generate a delimited bank payment file.
 *
 * Named for the UK BACS layout it was modelled on, but it is the only export
 * format now that the deployment is South Africa only. Confirm the exact layout
 * with the receiving bank before relying on it — this is a simplified shape,
 * not a certified one.
 */
export function generateBACS(payrolls: Array<{
  employeeId: string;
  employeeName: string;
  netSalary: number;
  /** Six-digit South African branch code. */
  branchCode?: string;
  accountNumber?: string;
  /** Accepted for the older call shape; branchCode is preferred. */
  sortCode?: string;
}>) {
  const rows = payrolls.map((p) => ({ ...p, sortCode: p.branchCode ?? p.sortCode }));
  assertBankDetails(rows);
  const lines = [
    `HDR1,COMPANY,${new Date().toISOString().slice(0, 10).replace(/-/g, "")},ZAR`,
    ...rows.map(p => [
      "DET1",
      p.sortCode || "000000",
      p.accountNumber || "00000000",
      p.employeeName,
      (p.netSalary * 100).toFixed(0),
    ].join(",")),
    "TLR1," + rows.length.toString().padStart(6, "0"),
  ];
  return lines.join("\n");
}

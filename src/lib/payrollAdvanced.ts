/**
 * Advanced payroll utilities: per-country currencies, tax tables, bank export formats.
 */

export type Currency = "USD" | "GBP" | "EUR" | "CAD" | "AUD" | "ZAR";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  CAD: "C$",
  AUD: "A$",
  ZAR: "R",
};

export const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  ZA: "ZAR",
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  CA: "CAD",
  AU: "AUD",
};

/**
 * Simple tax brackets (example for US; extend per country).
 */
export const TAX_BRACKETS_US: { min: number; max: number | null; rate: number }[] = [
  { min: 0, max: 11000, rate: 0.10 },
  { min: 11001, max: 44725, rate: 0.12 },
  { min: 44726, max: 95375, rate: 0.22 },
  { min: 95376, max: 182050, rate: 0.24 },
  { min: 182051, max: 231250, rate: 0.32 },
  { min: 231251, max: 578125, rate: 0.35 },
  { min: 578126, max: null, rate: 0.37 },
];

/**
 * Compute annual tax (simplified, single filer).
 */
export function computeTaxUS(annualGross: number): number {
  let tax = 0;
  let remaining = annualGross;
  for (const bracket of TAX_BRACKETS_US) {
    if (remaining <= 0) break;
    const taxable = bracket.max ? Math.min(remaining, bracket.max - bracket.min + 1) : remaining;
    tax += taxable * bracket.rate;
    remaining -= taxable;
  }
  return tax;
}

/**
 * Generate ACH (US) bank export format (simplified).
 */
export function generateACH(payrolls: Array<{
  employeeId: string;
  employeeName: string;
  netSalary: number;
  bankAccount?: string;
  routingNumber?: string;
}>) {
  const lines = [
    "101 1220000001 123456789 202502070000A094101Company Name           222222222",
    ...payrolls.map(p => [
      "627" + (p.routingNumber?.padStart(9, "0") || "000000000"),
      (p.bankAccount?.padStart(17, "0") || "00000000000000000"),
      (p.netSalary * 100).toFixed(0).padStart(10, "0"),
      "1" + p.employeeName.padEnd(22, " "),
    ].join("")),
    "8225000001000000000000010000000",
  ];
  return lines.join("\n");
}

/**
 * Generate UK BACS export format (simplified).
 */
export function generateBACS(payrolls: Array<{
  employeeId: string;
  employeeName: string;
  netSalary: number;
  sortCode?: string;
  accountNumber?: string;
}>) {
  const lines = [
    "HDR1,COMPANY,20250207,GBP",
    ...payrolls.map(p => [
      "DET1",
      p.sortCode || "000000",
      p.accountNumber || "00000000",
      p.employeeName,
      (p.netSalary * 100).toFixed(0),
    ].join(",")),
    "TLR1," + payrolls.length.toString().padStart(6, "0"),
  ];
  return lines.join("\n");
}

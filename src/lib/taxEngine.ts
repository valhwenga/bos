/**
 * South African payroll tax and statutory deductions.
 *
 * This was a multi-country engine covering US, GB and four countries that were
 * never implemented. It has been reduced to South Africa, which is the only
 * jurisdiction this deployment operates in. Two reasons beyond dead code:
 *
 *  * There were two independent and disagreeing US bracket tables — one here
 *    and one in payrollAdvanced.ts — so the tax an employee saw depended on
 *    which module a page happened to import. At a $200k salary they differed by
 *    $1,109.50.
 *  * CA, AU, DE and FR fell through to a flat 20% "placeholder" that was
 *    returned as though it were a real calculation. Inventing a tax figure is
 *    worse than refusing to produce one.
 *
 * Adding a country back means implementing it properly, not restoring a stub.
 */

export type TaxCountry = "ZA";

export interface TaxResult {
  incomeTax: number;
  statutoryDeductions: {
    paye?: number;
    uif?: number;
    sdl?: number;
  };
  totalDeductions: number;
  netPay: number;
}

/**
 * South African PAYE brackets, 2025 tax year.
 *
 * Bands are inclusive of `min` and `max`. Verify against the current SARS
 * tables at the start of each tax year — these change annually.
 */
const ZA_BRACKETS: { min: number; max: number | null; rate: number }[] = [
  { min: 0, max: 95_750, rate: 0.18 },
  { min: 95_751, max: 370_000, rate: 0.26 },
  { min: 370_001, max: 625_000, rate: 0.31 },
  { min: 625_001, max: null, rate: 0.36 },
];

const ZA_UIF_RATE = 0.01; // 1% of gross, capped
const ZA_UIF_MAX = 2_476.8; // annual employee contribution ceiling
const ZA_SDL_RATE = 0.01; // 1% of payroll

/** Progressive tax across the bands, charging each slice at its own rate. */
function taxFromBrackets(grossAnnual: number): number {
  let tax = 0;
  let remaining = grossAnnual;

  for (const bracket of ZA_BRACKETS) {
    if (remaining <= 0) break;
    const width = bracket.max === null ? remaining : bracket.max - bracket.min + 1;
    const taxable = Math.min(remaining, width);
    tax += taxable * bracket.rate;
    remaining -= taxable;
  }

  return tax;
}

export function computeTax(grossAnnual: number, country: TaxCountry = "ZA"): TaxResult {
  if (country !== "ZA") {
    // Unreachable through the type, but guards a value cast at a boundary
    // (stored settings, an import) rather than silently taxing at ZA rates.
    throw new Error(`Tax engine not implemented for country: ${country}`);
  }

  const gross = Math.max(0, grossAnnual);
  const incomeTax = taxFromBrackets(gross);
  const uif = Math.min(gross * ZA_UIF_RATE, ZA_UIF_MAX);
  const sdl = gross * ZA_SDL_RATE;
  const totalDeductions = incomeTax + uif + sdl;

  return {
    incomeTax,
    statutoryDeductions: { paye: incomeTax, uif, sdl },
    totalDeductions,
    netPay: gross - totalDeductions,
  };
}

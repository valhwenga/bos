/**
 * Multi-country tax engines and statutory deductions.
 * Extend with more countries and rules as needed.
 */
export type TaxCountry = "US" | "GB" | "ZA" | "CA" | "AU" | "DE" | "FR";

export interface TaxResult {
  incomeTax: number;
  statutoryDeductions: {
    socialSecurity?: number;
    medicare?: number;
    pension?: number;
    uif?: number; // South Africa
    sdl?: number; // South Africa
    paye?: number; // UK PAYE
    ni?: number; // UK National Insurance
  };
  totalDeductions: number;
  netPay: number;
}

// US Tax Brackets (2025, single filer)
const US_BRACKETS = [
  { min: 0, max: 11700, rate: 0.10 },
  { min: 11701, max: 47450, rate: 0.12 },
  { min: 47451, max: 100525, rate: 0.22 },
  { min: 100526, max: 191050, rate: 0.24 },
  { min: 191051, max: 243725, rate: 0.32 },
  { min: 243726, max: 609350, rate: 0.35 },
  { min: 609351, max: null, rate: 0.37 },
];

// UK PAYE and NI (2025/26)
const UK_BRACKETS = [
  { min: 0, max: 12570, rate: 0.20 },
  { min: 12571, max: 50270, rate: 0.40 },
  { min: 50271, max: 125140, rate: 0.45 },
  { min: 125141, max: null, rate: 0.50 },
];
const UK_NI_PRIMARY = {
  weeklyThreshold: 242,
  rate: 0.08,
};

// South Africa PAYE, UIF, SDL (2025)
const ZA_BRACKETS = [
  { min: 0, max: 95750, rate: 0.18 },
  { min: 95751, max: 370000, rate: 0.26 },
  { min: 370001, max: 625000, rate: 0.31 },
  { min: 625001, max: null, rate: 0.36 },
];
const ZA_UIF_RATE = 0.01; // 1% of gross, capped
const ZA_UIF_MAX = 2476.80;
const ZA_SDL_RATE = 0.01; // 1% of payroll

/**
 * Compute US tax and deductions.
 */
function computeUS(grossAnnual: number): TaxResult {
  let incomeTax = 0;
  let remaining = grossAnnual;
  for (const bracket of US_BRACKETS) {
    if (remaining <= 0) break;
    const taxable = bracket.max ? Math.min(remaining, bracket.max - bracket.min + 1) : remaining;
    incomeTax += taxable * bracket.rate;
    remaining -= taxable;
  }
  const socialSecurity = Math.min(grossAnnual * 0.062, 11700);
  const medicare = grossAnnual * 0.0145;
  const totalDeductions = incomeTax + socialSecurity + medicare;
  return {
    incomeTax,
    statutoryDeductions: { socialSecurity, medicare },
    totalDeductions,
    netPay: grossAnnual - totalDeductions,
  };
}

/**
 * Compute UK PAYE and NI.
 */
function computeUK(grossAnnual: number): TaxResult {
  let incomeTax = 0;
  let remaining = grossAnnual;
  for (const bracket of UK_BRACKETS) {
    if (remaining <= 0) break;
    const taxable = bracket.max ? Math.min(remaining, bracket.max - bracket.min + 1) : remaining;
    incomeTax += taxable * bracket.rate;
    remaining -= taxable;
  }
  const weeklyGross = grossAnnual / 52;
  const ni = weeklyGross > UK_NI_PRIMARY.weeklyThreshold ? (weeklyGross - UK_NI_PRIMARY.weeklyThreshold) * UK_NI_PRIMARY.rate * 52 : 0;
  const totalDeductions = incomeTax + ni;
  return {
    incomeTax,
    statutoryDeductions: { paye: incomeTax, ni },
    totalDeductions,
    netPay: grossAnnual - totalDeductions,
  };
}

/**
 * Compute South Africa PAYE, UIF, SDL.
 */
function computeZA(grossAnnual: number): TaxResult {
  let incomeTax = 0;
  let remaining = grossAnnual;
  for (const bracket of ZA_BRACKETS) {
    if (remaining <= 0) break;
    const taxable = bracket.max ? Math.min(remaining, bracket.max - bracket.min + 1) : remaining;
    incomeTax += taxable * bracket.rate;
    remaining -= taxable;
  }
  const uif = Math.min(grossAnnual * ZA_UIF_RATE, ZA_UIF_MAX);
  const sdl = grossAnnual * ZA_SDL_RATE;
  const totalDeductions = incomeTax + uif + sdl;
  return {
    incomeTax,
    statutoryDeductions: { paye: incomeTax, uif, sdl },
    totalDeductions,
    netPay: grossAnnual - totalDeductions,
  };
}

/**
 * Main tax engine dispatcher.
 */
export function computeTax(grossAnnual: number, country: TaxCountry): TaxResult {
  switch (country) {
    case "US":
      return computeUS(grossAnnual);
    case "GB":
      return computeUK(grossAnnual);
    case "ZA":
      return computeZA(grossAnnual);
    case "CA":
    case "AU":
    case "DE":
    case "FR":
    // Placeholder: return simple 20% tax
      const incomeTax = grossAnnual * 0.20;
      return {
        incomeTax,
        statutoryDeductions: {},
        totalDeductions: incomeTax,
        netPay: grossAnnual - incomeTax,
      };
    default:
      throw new Error(`Tax engine not implemented for country: ${country}`);
  }
}

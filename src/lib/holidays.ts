/**
 * Public holiday calendar per country (YYYY-MM-DD)
 * Extend as needed.
 */
export const PUBLIC_HOLIDAYS: Record<string, string[]> = {
  ZA: [
    "2025-01-01", // New Year's Day
    "2025-03-21", // Human Rights Day
    "2025-04-18", // Good Friday
    "2025-04-21", // Family Day
    "2025-04-27", // Freedom Day
    "2025-05-01", // Workers' Day
    "2025-06-16", // Youth Day
    "2025-08-09", // National Women's Day
    "2025-09-24", // Heritage Day
    "2025-12-16", // Day of Reconciliation
    "2025-12-25", // Christmas Day
    "2025-12-26", // Day of Goodwill
  ],
  US: [
    "2025-01-01", // New Year's Day
    "2025-01-20", // Martin Luther King Jr. Day
    "2025-02-17", // Presidents' Day
    "2025-05-26", // Memorial Day
    "2025-07-04", // Independence Day
    "2025-09-01", // Labor Day
    "2025-10-13", // Columbus Day
    "2025-11-11", // Veterans Day
    "2025-11-27", // Thanksgiving Day
    "2025-12-25", // Christmas Day
  ],
  GB: [
    "2025-01-01", // New Year's Day
    "2025-04-18", // Good Friday
    "2025-04-21", // Easter Monday
    "2025-05-05", // Early May Bank Holiday
    "2025-05-26", // Spring Bank Holiday
    "2025-08-25", // Summer Bank Holiday
    "2025-12-25", // Christmas Day
    "2025-12-26", // Boxing Day
  ],
  CA: [
    "2025-01-01", // New Year's Day
    "2025-02-17", // Family Day
    "2025-04-18", // Good Friday
    "2025-05-19", // Victoria Day
    "2025-07-01", // Canada Day
    "2025-08-04", // Civic Holiday
    "2025-09-01", // Labour Day
    "2025-10-13", // Thanksgiving
    "2025-11-11", // Remembrance Day
    "2025-12-25", // Christmas Day
    "2025-12-26", // Boxing Day
  ],
  AU: [
    "2025-01-01", // New Year's Day
    "2025-01-26", // Australia Day
    "2025-04-18", // Good Friday
    "2025-04-21", // Easter Monday
    "2025-04-25", // ANZAC Day
    "2025-06-09", // King's Birthday
    "2025-12-25", // Christmas Day
    "2025-12-26", // Boxing Day
  ],
  // Add more countries as needed
};

/**
 * Check if a date is a public holiday for a given country.
 */
export function isPublicHoliday(date: string, country: keyof typeof PUBLIC_HOLIDAYS): boolean {
  return PUBLIC_HOLIDAYS[country]?.includes(date) ?? false;
}

/**
 * Get public holidays for a country in a given month/year.
 */
export function getPublicHolidaysInMonth(year: number, month: number, country: keyof typeof PUBLIC_HOLIDAYS): string[] {
  const monthStr = String(month + 1).padStart(2, "0");
  return (PUBLIC_HOLIDAYS[country] ?? []).filter(d => d.startsWith(`${year}-${monthStr}`));
}

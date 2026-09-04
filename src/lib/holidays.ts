/**
 * South African public holidays.
 *
 * This was a hand-typed map of several countries, each holding a fixed list of
 * 2025 dates. Two problems with that, beyond covering countries this
 * deployment does not operate in:
 *
 *  * The lists stopped at 2025. Leave taken in any later year counted every
 *    public holiday as a working day, so employees were charged annual leave
 *    for Christmas Day, Freedom Day and the rest.
 *  * Good Friday and Family Day move with Easter, so they cannot be expressed
 *    as fixed dates at all.
 *
 * Holidays are now derived for any year, following the Public Holidays Act
 * (Act 36 of 1994), including the rule that a holiday falling on a Sunday is
 * observed on the Monday.
 */

/** Fixed-date holidays, as month/day. */
const FIXED: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 3, day: 21, name: "Human Rights Day" },
  { month: 4, day: 27, name: "Freedom Day" },
  { month: 5, day: 1, name: "Workers' Day" },
  { month: 6, day: 16, name: "Youth Day" },
  { month: 8, day: 9, name: "National Women's Day" },
  { month: 9, day: 24, name: "Heritage Day" },
  { month: 12, day: 16, name: "Day of Reconciliation" },
  { month: 12, day: 25, name: "Christmas Day" },
  { month: 12, day: 26, name: "Day of Goodwill" },
];

export type PublicHoliday = {
  /** YYYY-MM-DD */
  date: string;
  name: string;
  /** True when this is the Monday granted because the holiday fell on a Sunday. */
  observed?: boolean;
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Easter Sunday by the anonymous Gregorian algorithm. Good Friday and Family
 * Day are anchored to it, which is why they cannot be hardcoded.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Every public holiday in a year, including Mondays observed in lieu of a
 * Sunday holiday.
 */
export function publicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);

  const base: PublicHoliday[] = [
    ...FIXED.map(({ month, day, name }) => ({
      date: iso(new Date(year, month - 1, day)),
      name,
    })),
    { date: iso(addDays(easter, -2)), name: "Good Friday" },
    { date: iso(addDays(easter, 1)), name: "Family Day" },
  ];

  // Public Holidays Act: a holiday falling on a Sunday is observed on the
  // Monday. Good Friday and Family Day never fall on a Sunday, so only the
  // fixed dates can trigger this.
  const observed: PublicHoliday[] = [];
  for (const holiday of base) {
    const date = new Date(`${holiday.date}T00:00:00`);
    if (date.getDay() === 0) {
      observed.push({
        date: iso(addDays(date, 1)),
        name: `${holiday.name} (observed)`,
        observed: true,
      });
    }
  }

  return [...base, ...observed].sort((a, b) => a.date.localeCompare(b.date));
}

/** Cached per year; the calculation is pure and the set never changes. */
const cache = new Map<number, Set<string>>();

function holidaySet(year: number): Set<string> {
  let set = cache.get(year);
  if (!set) {
    set = new Set(publicHolidays(year).map((h) => h.date));
    cache.set(year, set);
  }
  return set;
}

/** Whether a YYYY-MM-DD date is a South African public holiday. */
export function isPublicHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  return holidaySet(year).has(date);
}

/** Holidays in a given month. `month` is zero-based, matching Date. */
export function getPublicHolidaysInMonth(year: number, month: number): PublicHoliday[] {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return publicHolidays(year).filter((h) => h.date.startsWith(prefix));
}

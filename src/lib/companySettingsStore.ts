/**
 * Company-wide settings.
 *
 * `country` is retained because stored records carry it, but the app is South
 * Africa only: holidays and PAYE no longer branch on it.
 */
export type CompanySettings = {
  name: string;
  country: "ZA";
  currencySymbol: string;
  fiscalYearStart: string; // MM-DD
};

const K = { settings: "company.settings" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => {
  try { window.dispatchEvent(new Event(name)); } catch { void 0; }
};

const DEFAULT: CompanySettings = {
  name: "Demo Company",
  country: "ZA",
  currencySymbol: "R",
  fiscalYearStart: "01-01",
};

export const CompanySettingsStore = {
  get(): CompanySettings {
    return r<CompanySettings>(K.settings, DEFAULT);
  },
  set(settings: CompanySettings) {
    w(K.settings, settings);
    emit("company.settings-changed");
  },
  update(patch: Partial<CompanySettings>) {
    this.set({ ...this.get(), ...patch });
  },
};

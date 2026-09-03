/**
 * Company settings: the name, banking details, brand colours and logo that
 * every printed and emailed document draws on.
 *
 * These were in localStorage, which meant they were set per machine. Whoever
 * entered the banking details had them on their invoices and nobody else did —
 * a document sent from a second computer went out with no banking block and the
 * default company name, and the first sign of trouble was a customer asking
 * where to pay.
 *
 * Reads stay synchronous from a cache, because they happen during render on
 * every document. Writes are async and go to the server.
 */

import { createCache } from "./collectionCache";
import { CompanySettingsRepo } from "./companySettingsRepo";

export type CompanySettings = {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  taxRatePct?: number; // e.g., 15 means 15%
  currencyCode: string; // ZAR
  currencySymbol: string; // R
  /** MM-DD. 1 March, the start of the South African tax year. */
  fiscalYearStart?: string;
  primaryColor?: string; // brand colour used on printed documents
  secondaryColor?: string; // companion shade for document accents
  bankName?: string;
  bankAccount?: string;
  branchCode?: string;
  branchName?: string;
  bankSwift?: string;
  bankIban?: string;
  customerNotesDefault?: string;
  footerNote?: string;
  /**
   * A URL to the stored image, not a base64 data URL.
   *
   * The name is kept because it is used in about forty places and the value is
   * still something an <img src> accepts; what changed is where the bytes live.
   */
  logoDataUrl?: string;
  signatureDataUrl?: string;
};

export const DEFAULT_SETTINGS: CompanySettings = {
  name: "Your Company",
  currencyCode: "ZAR",
  currencySymbol: "R",
  fiscalYearStart: "03-01",
  taxRatePct: 0,
  primaryColor: "#128768",
  secondaryColor: "#1BA37E",
};

/**
 * A single row, cached as one entry.
 *
 * Held as a collection of one so it can reuse the same cache and subscription
 * machinery as everything else.
 */
export const companySettingsCache = createCache<CompanySettings>(async () => [
  await CompanySettingsRepo.get(),
]);

export const CompanySettingsStore = {
  /**
   * Merges over the defaults rather than returning the row as-is, so a field
   * that is null in the database does not render as "undefined" on an invoice.
   */
  get(): CompanySettings {
    return { ...DEFAULT_SETTINGS, ...(companySettingsCache.list()[0] ?? {}) };
  },

  load(): Promise<CompanySettings[]> {
    return companySettingsCache.ensureLoaded();
  },

  async set(s: CompanySettings): Promise<CompanySettings> {
    await companySettingsCache.mutate(() => CompanySettingsRepo.update(s));
    announce();
    return s;
  },

  async update(patch: Partial<CompanySettings>): Promise<CompanySettings> {
    const next = { ...this.get(), ...patch };
    return this.set(next);
  },

  /** Replaces the logo or signature image. */
  async setImage(kind: "logo" | "signature", file: File): Promise<void> {
    await companySettingsCache.mutate(() => CompanySettingsRepo.setImage(kind, file));
    announce();
  },

  async clearImage(kind: "logo" | "signature"): Promise<void> {
    await companySettingsCache.mutate(() => CompanySettingsRepo.clearImage(kind));
    announce();
  },
};

const announce = () => {
  try {
    window.dispatchEvent(new Event("company.settings-changed"));
  } catch {
    void 0;
  }
};

export type CompanySettings = {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  taxRatePct?: number; // e.g., 15 means 15%
  currencyCode: string; // e.g., USD
  currencySymbol: string; // e.g., $
  bankName?: string;
  bankAccount?: string;
  branchCode?: string;
  branchName?: string;
  bankSwift?: string;
  bankIban?: string;
  customerNotesDefault?: string;
  footerNote?: string;
  logoDataUrl?: string; // uploaded data URL for inline prints
  signatureDataUrl?: string; // uploaded signature image data URL
};

const K = { settings: "acct.company.settings" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const DEFAULTS: CompanySettings = {
  name: "Your Company",
  address: "123 Business Rd, City, Country",
  email: "info@company.com",
  phone: "+1 555-123-4567",
  taxRatePct: 0,
  currencyCode: "USD",
  currencySymbol: "$",
  bankName: "Bank Name",
  bankAccount: "000123456789",
  branchCode: "123456",
  branchName: "Main Branch",
  bankSwift: "BKCHUS33",
  bankIban: "DE89 3704 0044 0532 0130 00",
  customerNotesDefault: "Thank you for your business!",
  footerNote: "Payment due within 15 days.",
  logoDataUrl: undefined,
  signatureDataUrl: undefined,
};

export const CompanySettingsStore = {
  get(): CompanySettings { return r<CompanySettings>(K.settings, DEFAULTS); },
  set(s: CompanySettings) { w(K.settings, s); return s; },
  update(patch: Partial<CompanySettings>) { const cur = this.get(); const next = { ...cur, ...patch }; return this.set(next); }
};

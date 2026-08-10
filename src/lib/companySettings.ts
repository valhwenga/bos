export type CompanySettings = {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  taxRatePct?: number; // e.g., 15 means 15%
  currencyCode: string; // e.g., USD
  currencySymbol: string; // e.g., $
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
  primaryColor: "#128768",
  secondaryColor: "#1BA37E",
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
  /**
   * Merges over DEFAULTS rather than returning the stored object as-is. A
   * settings record saved before a field existed would otherwise come back
   * without it, and the missing value renders as "undefined" on invoices and
   * payslips — so every new setting would break documents for existing users.
   */
  get(): CompanySettings {
    return { ...DEFAULTS, ...r<Partial<CompanySettings>>(K.settings, {}) };
  },
  
  set(s: CompanySettings) { 
    w(K.settings, s); 
    
    // Emit change event for components to update
    try { 
      window.dispatchEvent(new Event("company.settings-changed")); 
    } catch { 
      void 0; 
    }
    
    return s; 
  },
  
  update(patch: Partial<CompanySettings>) { 
    const current = this.get();
    const next = { ...current, ...patch }; 
    return this.set(next); 
  }
};

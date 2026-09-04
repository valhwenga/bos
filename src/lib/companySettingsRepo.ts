/**
 * Postgres reads and writes for company settings.
 *
 * The table holds exactly one row — a check constraint on the primary key makes
 * a second impossible — so this reads and updates that row rather than treating
 * it as a collection.
 *
 * The logo and signature are files in the company-assets bucket. They used to
 * be base64 data URLs stored inline; a scanned signature that way is a large
 * string on a row that is read on every page load.
 */

import { supabase } from "./supabase";
import type { CompanySettings } from "./companySettings";

const BUCKET = "company-assets";

type Row = {
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  tax_rate_pct: number | string | null;
  currency_code: string;
  currency_symbol: string;
  fiscal_year_start: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  bank_name: string | null;
  bank_account: string | null;
  branch_code: string | null;
  branch_name: string | null;
  bank_swift: string | null;
  bank_iban: string | null;
  customer_notes_default: string | null;
  footer_note: string | null;
  logo_path: string | null;
  signature_path: string | null;
};

const COLUMNS =
  "name, address, email, phone, tax_id, tax_rate_pct, currency_code, currency_symbol, fiscal_year_start, primary_color, secondary_color, bank_name, bank_account, branch_code, branch_name, bank_swift, bank_iban, customer_notes_default, footer_note, logo_path, signature_path";

/**
 * The bucket is public to read, so this is a plain URL rather than a signed
 * one — the logo has to render on the login page, where there is no session to
 * sign with.
 */
function publicUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const toSettings = (row: Row): CompanySettings => ({
  name: row.name,
  address: row.address ?? undefined,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  taxId: row.tax_id ?? undefined,
  taxRatePct: row.tax_rate_pct === null ? undefined : Number(row.tax_rate_pct),
  currencyCode: row.currency_code,
  currencySymbol: row.currency_symbol,
  fiscalYearStart: row.fiscal_year_start ?? undefined,
  primaryColor: row.primary_color ?? undefined,
  secondaryColor: row.secondary_color ?? undefined,
  bankName: row.bank_name ?? undefined,
  bankAccount: row.bank_account ?? undefined,
  branchCode: row.branch_code ?? undefined,
  branchName: row.branch_name ?? undefined,
  bankSwift: row.bank_swift ?? undefined,
  bankIban: row.bank_iban ?? undefined,
  customerNotesDefault: row.customer_notes_default ?? undefined,
  footerNote: row.footer_note ?? undefined,
  logoDataUrl: publicUrl(row.logo_path),
  signatureDataUrl: publicUrl(row.signature_path),
});

export const CompanySettingsRepo = {
  async get(): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from("company_settings")
      .select(COLUMNS)
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Company settings row is missing.");
    return toSettings(data as Row);
  },

  async update(s: CompanySettings): Promise<CompanySettings> {
    // logo and signature are deliberately absent: they are files, changed
    // through setImage, and writing a URL back into a path column would store
    // the wrong thing entirely.
    // `select()` matters: row level security filters an update the caller may
    // not make rather than rejecting it, so without asking for the affected row
    // back this returns no error and the app says "Settings saved" while
    // nothing changed.
    const { data, error } = await supabase
      .from("company_settings")
      .update({
        name: s.name,
        address: s.address ?? null,
        email: s.email ?? null,
        phone: s.phone ?? null,
        tax_id: s.taxId ?? null,
        tax_rate_pct: s.taxRatePct ?? 0,
        currency_code: s.currencyCode,
        currency_symbol: s.currencySymbol,
        fiscal_year_start: s.fiscalYearStart ?? "03-01",
        primary_color: s.primaryColor ?? null,
        secondary_color: s.secondaryColor ?? null,
        bank_name: s.bankName ?? null,
        bank_account: s.bankAccount ?? null,
        branch_code: s.branchCode ?? null,
        branch_name: s.branchName ?? null,
        bank_swift: s.bankSwift ?? null,
        bank_iban: s.bankIban ?? null,
        customer_notes_default: s.customerNotesDefault ?? null,
        footer_note: s.footerNote ?? null,
      })
      .eq("id", true)
      .select("name");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("You need edit access to settings to change these.");
    }
    return this.get();
  },

  async setImage(kind: "logo" | "signature", file: File): Promise<void> {
    const column = kind === "logo" ? "logo_path" : "signature_path";
    // A fixed name per kind, so replacing one does not accumulate orphans, with
    // the extension kept so the browser gets the right content type.
    const extension = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${kind}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    // Written after the upload: pointing the row at a file that failed to
    // upload would show a broken image on every document.
    const { data, error } = await supabase
      .from("company_settings")
      .update({ [column]: path })
      .eq("id", true)
      .select("name");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      // The file uploaded but the row could not be pointed at it, so remove it
      // rather than leaving an orphan in the bucket.
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error("You need edit access to settings to change the company images.");
    }

    // A previous image with a different extension would otherwise linger.
    const stale = ["png", "jpg", "jpeg", "webp", "svg"]
      .filter((e) => e !== extension)
      .map((e) => `${kind}.${e}`);
    await supabase.storage.from(BUCKET).remove(stale);
  },

  async clearImage(kind: "logo" | "signature"): Promise<void> {
    const column = kind === "logo" ? "logo_path" : "signature_path";
    const { data: existing } = await supabase
      .from("company_settings")
      .select(column)
      .eq("id", true)
      .maybeSingle();
    const path = (existing as Record<string, string | null> | null)?.[column];

    const { data, error } = await supabase
      .from("company_settings")
      .update({ [column]: null })
      .eq("id", true)
      .select("name");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("You need edit access to settings to change the company images.");
    }

    if (path) await supabase.storage.from(BUCKET).remove([path]);
  },
};

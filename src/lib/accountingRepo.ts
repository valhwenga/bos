/**
 * Postgres reads and writes for accounting.
 *
 * The app's Quotation/Invoice/Payment types are kept exactly as they were, so
 * the pages and the print sheets do not have to change shape. This module is
 * the only place that knows the database column names, and the only place that
 * translates between the two.
 *
 * Two mapping decisions worth stating:
 *
 *  - Ids. localStorage used strings like `inv_1727...`; the database uses uuids.
 *    Rows carry the original in `legacy_id`, and that is what the app continues
 *    to use as `id`, so links held elsewhere (a payment's invoiceId, a
 *    quotation's sourceQuoteId, a printed document's URL) keep resolving after
 *    the migration.
 *
 *  - Customers. A document keeps `customer_snapshot`, a copy of the customer as
 *    they were when it was issued. An invoice must not silently change its
 *    billing address because someone edited the customer record afterwards —
 *    the printed document is a record of what was sent.
 */

import { supabase } from "./supabase";
import type { Customer } from "./customersStore";
import type { Invoice, LineItem, Quotation } from "./accountingStore";
import type { Payment, PaymentMethod } from "./paymentStore";
import type { Product } from "./productsStore";
import type { Expense } from "./expenseStore";
import type { Sale, SaleItem } from "./salesStore";
import type { CreditNote, CreditApply } from "./creditNotesStore";
import type { RecurringTemplate } from "./recurringStore";

/** The app's id for a row: its legacy id if it has one, else the uuid. */
const appId = (row: { id: string; legacy_id: string | null }) => row.legacy_id ?? row.id;

type LineItemRow = {
  id: string;
  legacy_id: string | null;
  position: number;
  name: string;
  description: string | null;
  qty: number | string;
  price: number | string;
};

const toLineItem = (row: LineItemRow): LineItem => ({
  id: appId(row),
  name: row.name,
  description: row.description ?? undefined,
  qty: Number(row.qty),
  price: Number(row.price),
});

const num = (v: unknown): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);

/** Dates are stored as `date`, but the app carries ISO timestamps. */
const toIso = (d: string | null): string | undefined => (d ? new Date(d).toISOString() : undefined);
const toDate = (iso: string | undefined | null): string | null =>
  iso ? new Date(iso).toISOString().slice(0, 10) : null;


/**
 * Columns that are NOT NULL but carry a database default.
 *
 * Sending an explicit null for one of these overrides the default and trips the
 * constraint, which is how an import of older rows — where the field was simply
 * absent — fails. Dropping the key instead lets the default apply.
 *
 * Only these columns are stripped. Every other null is passed through, so a
 * field can still be deliberately cleared.
 */
const DEFAULTED_COLUMNS: Record<string, readonly string[]> = {
  customers: ["shipping_same_as_billing", "tags"],
  products: ["price"],
  expenses: ["amount", "currency_code", "spent_on", "tax"],
  sales: ["items", "sold_on"],
  credit_notes: ["amount", "issue_date"],
  recurring_templates: ["active", "auto_send", "cadence", "items", "start_date", "time_of_day"],
  quotations: ["discount_pct", "issue_date", "shipping", "status", "use_shipping_address"],
  invoices: ["discount_pct", "issue_date", "shipping", "status", "use_shipping_address"],
  payments: ["currency_code", "method", "paid_on"],
  line_items: ["position", "price", "qty"],
};

function applyDefaults<T extends Record<string, unknown>>(table: keyof typeof DEFAULTED_COLUMNS, payload: T): Partial<T> {
  const defaulted = DEFAULTED_COLUMNS[table] ?? [];
  const out: Record<string, unknown> = { ...payload };
  for (const column of defaulted) {
    if (out[column] === null || out[column] === undefined) delete out[column];
  }
  return out as Partial<T>;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

type CustomerRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  tax_number: string | null;
  billing_address: Customer["billingAddress"] | null;
  shipping_address: Customer["shippingAddress"] | null;
  shipping_same_as_billing: boolean | null;
  responsible: Customer["responsible"] | null;
  tags: string[] | null;
};

const toCustomer = (row: CustomerRow): Customer => ({
  id: appId(row),
  name: row.name,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  companyName: row.company_name ?? undefined,
  taxNumber: row.tax_number ?? undefined,
  billingAddress: row.billing_address ?? undefined,
  shippingAddress: row.shipping_address ?? undefined,
  shippingSameAsBilling: row.shipping_same_as_billing ?? undefined,
  responsible: row.responsible ?? undefined,
  tags: row.tags ?? undefined,
});

const CUSTOMER_COLUMNS =
  "id, legacy_id, name, email, phone, company_name, tax_number, billing_address, shipping_address, shipping_same_as_billing, responsible, tags";

export const CustomerRepo = {
  async list(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .order("name");
    if (error) throw new Error(error.message);
    return (data as CustomerRow[]).map(toCustomer);
  },

  /**
   * Finds a customer by the app's id, or creates one. Documents reference a
   * customer row, so a quotation for a customer that only existed in the
   * browser needs that customer to exist before it can be saved.
   */
  async ensure(customer: Customer): Promise<string> {
    const { data: found } = await supabase
      .from("customers")
      .select("id")
      .or(`legacy_id.eq.${customer.id},id.eq.${isUuid(customer.id) ? customer.id : NIL_UUID}`)
      .maybeSingle();
    if (found) return found.id;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        legacy_id: isUuid(customer.id) ? null : customer.id,
        name: customer.name,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        company_name: customer.companyName ?? null,
        tax_number: customer.taxNumber ?? null,
        billing_address: customer.billingAddress ?? null,
        shipping_address: customer.shippingAddress ?? null,
        // NOT NULL with a default: passing null would override the default and
        // violate the constraint.
        shipping_same_as_billing: customer.shippingSameAsBilling ?? false,
        responsible: customer.responsible ?? null,
        tags: customer.tags ?? [],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async upsert(customer: Customer): Promise<Customer> {
    const id = await this.ensure(customer);
    const { data, error } = await supabase
      .from("customers")
      .update({
        name: customer.name,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
        company_name: customer.companyName ?? null,
        tax_number: customer.taxNumber ?? null,
        billing_address: customer.billingAddress ?? null,
        shipping_address: customer.shippingAddress ?? null,
        shipping_same_as_billing: customer.shippingSameAsBilling ?? false,
        responsible: customer.responsible ?? null,
        tags: customer.tags ?? [],
      })
      .eq("id", id)
      .select(CUSTOMER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toCustomer(data as CustomerRow);
  },

  async remove(appCustomerId: string): Promise<void> {
    const { error } = await supabase.from("customers").delete().eq(...idFilter(appCustomerId));
    if (error) throw new Error(error.message);
  },
};

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

/** Matches a row by whichever id column the app's id corresponds to. */
const idFilter = (appIdValue: string): [string, string] =>
  isUuid(appIdValue) ? ["id", appIdValue] : ["legacy_id", appIdValue];

// ---------------------------------------------------------------------------
// Quotations and invoices
// ---------------------------------------------------------------------------

type DocumentRow = {
  id: string;
  legacy_id: string | null;
  number: string;
  customer_id: string | null;
  customer_snapshot: Customer | null;
  status: string;
  issue_date: string | null;
  reference: string | null;
  notes: string | null;
  discount_pct: number | string | null;
  shipping: number | string | null;
  use_shipping_address: boolean | null;
  created_at: string;
  updated_at: string | null;
  line_items: LineItemRow[];
};

type QuotationRow = DocumentRow & {
  expiry_date: string | null;
  subject: string | null;
  salesperson: string | null;
  project_name: string | null;
};

type InvoiceRow = DocumentRow & {
  due_date: string | null;
  source_quotation_id: string | null;
};

const sortedItems = (rows: LineItemRow[]) =>
  [...(rows ?? [])].sort((a, b) => a.position - b.position).map(toLineItem);

const QUOTATION_COLUMNS = `
  id, legacy_id, number, customer_id, customer_snapshot, status, issue_date,
  expiry_date, reference, subject, salesperson, project_name, notes,
  discount_pct, shipping, use_shipping_address, created_at, updated_at,
  line_items ( id, legacy_id, position, name, description, qty, price )
`;

const INVOICE_COLUMNS = `
  id, legacy_id, number, customer_id, customer_snapshot, status, issue_date,
  due_date, source_quotation_id, reference, notes, discount_pct, shipping,
  use_shipping_address, created_at, updated_at,
  line_items ( id, legacy_id, position, name, description, qty, price )
`;

const toQuotation = (row: QuotationRow): Quotation => ({
  id: appId(row),
  number: row.number,
  customer: (row.customer_snapshot ?? { id: "", name: "" }) as Customer,
  items: sortedItems(row.line_items),
  status: row.status as Quotation["status"],
  createdAt: toIso(row.issue_date) ?? row.created_at,
  notes: row.notes ?? undefined,
  reference: row.reference ?? undefined,
  expiryDate: toIso(row.expiry_date),
  subject: row.subject ?? undefined,
  salesperson: row.salesperson ?? undefined,
  projectName: row.project_name ?? undefined,
  discountPct: num(row.discount_pct),
  shipping: num(row.shipping),
  useShippingAddress: row.use_shipping_address ?? undefined,
});

const toInvoice = (row: InvoiceRow, quoteLegacyById: Map<string, string>): Invoice => ({
  id: appId(row),
  number: row.number,
  customer: (row.customer_snapshot ?? { id: "", name: "" }) as Customer,
  items: sortedItems(row.line_items),
  status: row.status as Invoice["status"],
  createdAt: toIso(row.issue_date) ?? row.created_at,
  updatedAt: row.updated_at ?? undefined,
  sourceQuoteId: row.source_quotation_id
    ? quoteLegacyById.get(row.source_quotation_id) ?? row.source_quotation_id
    : undefined,
  useShippingAddress: row.use_shipping_address ?? undefined,
  discountPct: num(row.discount_pct),
  shipping: num(row.shipping),
  dueDate: toIso(row.due_date),
  reference: row.reference ?? undefined,
  notes: row.notes ?? undefined,
});

/** Replaces a document's line items. Simpler and safer than diffing them. */
async function replaceLineItems(
  column: "quotation_id" | "invoice_id",
  documentUuid: string,
  items: LineItem[],
): Promise<void> {
  const { error: delError } = await supabase.from("line_items").delete().eq(column, documentUuid);
  if (delError) throw new Error(delError.message);
  if (items.length === 0) return;

  const { error } = await supabase.from("line_items").insert(
    items.map((item, position) => ({
      [column]: documentUuid,
      legacy_id: isUuid(item.id) ? null : item.id,
      position,
      name: item.name,
      description: item.description ?? null,
      qty: item.qty,
      price: item.price,
    })),
  );
  if (error) throw new Error(error.message);
}

export const QuotationRepo = {
  async list(): Promise<Quotation[]> {
    const { data, error } = await supabase
      .from("quotations")
      .select(QUOTATION_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as QuotationRow[]).map(toQuotation);
  },

  async upsert(q: Quotation): Promise<Quotation> {
    const customerId = q.customer?.id ? await CustomerRepo.ensure(q.customer) : null;

    const payload = {
      number: q.number,
      customer_id: customerId,
      // A copy of the customer as they were when this was issued.
      customer_snapshot: q.customer ?? null,
      status: q.status,
      issue_date: toDate(q.createdAt),
      expiry_date: toDate(q.expiryDate),
      reference: q.reference ?? null,
      subject: q.subject ?? null,
      salesperson: q.salesperson ?? null,
      project_name: q.projectName ?? null,
      notes: q.notes ?? null,
      discount_pct: q.discountPct ?? null,
      shipping: q.shipping ?? null,
      use_shipping_address: q.useShippingAddress ?? null,
    };

    const { data: existing } = await supabase
      .from("quotations")
      .select("id")
      .eq(...idFilter(q.id))
      .maybeSingle();

    let uuid: string;
    if (existing) {
      const { error } = await supabase.from("quotations").update(applyDefaults("quotations", payload)).eq("id", existing.id);
      if (error) throw new Error(error.message);
      uuid = existing.id;
    } else {
      const { data, error } = await supabase
        .from("quotations")
        .insert(applyDefaults("quotations", { ...payload, legacy_id: isUuid(q.id) ? null : q.id }))
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      uuid = data.id;
    }

    await replaceLineItems("quotation_id", uuid, q.items ?? []);
    return q;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("quotations").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },

  /** The database uuid for an app id, needed when linking documents. */
  async uuidFor(id: string): Promise<string | null> {
    const { data } = await supabase
      .from("quotations")
      .select("id")
      .eq(...idFilter(id))
      .maybeSingle();
    return data?.id ?? null;
  },
};

export const InvoiceRepo = {
  async list(): Promise<Invoice[]> {
    const [{ data, error }, { data: quotes }] = await Promise.all([
      supabase.from("invoices").select(INVOICE_COLUMNS).order("created_at", { ascending: false }),
      supabase.from("quotations").select("id, legacy_id"),
    ]);
    if (error) throw new Error(error.message);

    // Invoices link to quotations by uuid, but the app refers to quotations by
    // their app id, so translate on the way out.
    const quoteLegacyById = new Map<string, string>();
    for (const q of (quotes ?? []) as { id: string; legacy_id: string | null }[]) {
      quoteLegacyById.set(q.id, q.legacy_id ?? q.id);
    }

    return (data as unknown as InvoiceRow[]).map((row) => toInvoice(row, quoteLegacyById));
  },

  async upsert(inv: Invoice): Promise<Invoice> {
    const customerId = inv.customer?.id ? await CustomerRepo.ensure(inv.customer) : null;
    const sourceUuid = inv.sourceQuoteId ? await QuotationRepo.uuidFor(inv.sourceQuoteId) : null;

    const payload = {
      number: inv.number,
      customer_id: customerId,
      customer_snapshot: inv.customer ?? null,
      status: inv.status,
      issue_date: toDate(inv.createdAt),
      due_date: toDate(inv.dueDate),
      source_quotation_id: sourceUuid,
      reference: inv.reference ?? null,
      notes: inv.notes ?? null,
      discount_pct: inv.discountPct ?? null,
      shipping: inv.shipping ?? null,
      use_shipping_address: inv.useShippingAddress ?? null,
    };

    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq(...idFilter(inv.id))
      .maybeSingle();

    let uuid: string;
    if (existing) {
      const { error } = await supabase.from("invoices").update(applyDefaults("invoices", payload)).eq("id", existing.id);
      if (error) throw new Error(error.message);
      uuid = existing.id;
    } else {
      const { data, error } = await supabase
        .from("invoices")
        .insert(applyDefaults("invoices", { ...payload, legacy_id: isUuid(inv.id) ? null : inv.id }))
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      uuid = data.id;
    }

    await replaceLineItems("invoice_id", uuid, inv.items ?? []);
    return inv;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("invoices").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },

  async uuidFor(id: string): Promise<string | null> {
    const { data } = await supabase
      .from("invoices")
      .select("id")
      .eq(...idFilter(id))
      .maybeSingle();
    return data?.id ?? null;
  },
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

type PaymentRow = {
  id: string;
  legacy_id: string | null;
  customer_id: string | null;
  invoice_id: string | null;
  quotation_id: string | null;
  amount: number | string;
  currency_code: string | null;
  paid_on: string | null;
  method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

const PAYMENT_COLUMNS =
  "id, legacy_id, customer_id, invoice_id, quotation_id, amount, currency_code, paid_on, method, reference, notes, created_at";

export const PaymentRepo = {
  async list(): Promise<Payment[]> {
    const [{ data, error }, { data: invoices }, { data: quotes }, { data: customers }] =
      await Promise.all([
        supabase.from("payments").select(PAYMENT_COLUMNS).order("paid_on", { ascending: false }),
        supabase.from("invoices").select("id, legacy_id"),
        supabase.from("quotations").select("id, legacy_id"),
        supabase.from("customers").select("id, legacy_id"),
      ]);
    if (error) throw new Error(error.message);

    const appIdOf = (rows: { id: string; legacy_id: string | null }[] | null) => {
      const m = new Map<string, string>();
      for (const r of rows ?? []) m.set(r.id, r.legacy_id ?? r.id);
      return m;
    };
    const invoiceIds = appIdOf(invoices);
    const quoteIds = appIdOf(quotes);
    const customerIds = appIdOf(customers);

    return (data as PaymentRow[]).map((row) => ({
      id: appId(row),
      customerId: row.customer_id ? customerIds.get(row.customer_id) ?? row.customer_id : "",
      invoiceId: row.invoice_id ? invoiceIds.get(row.invoice_id) ?? row.invoice_id : undefined,
      quoteId: row.quotation_id ? quoteIds.get(row.quotation_id) ?? row.quotation_id : undefined,
      amount: Number(row.amount),
      currencyCode: row.currency_code ?? "ZAR",
      date: toIso(row.paid_on) ?? row.created_at,
      method: row.method as PaymentMethod,
      reference: row.reference ?? undefined,
      notes: row.notes ?? undefined,
    }));
  },

  async upsert(p: Payment): Promise<Payment> {
    const [invoiceUuid, quoteUuid] = await Promise.all([
      p.invoiceId ? InvoiceRepo.uuidFor(p.invoiceId) : Promise.resolve(null),
      p.quoteId ? QuotationRepo.uuidFor(p.quoteId) : Promise.resolve(null),
    ]);

    // Refuse rather than store a payment whose invoice or quotation could not be
    // found. Saving it unlinked would leave money recorded against nothing, and
    // the invoice still showing as unpaid.
    if (p.invoiceId && !invoiceUuid) {
      throw new Error(`Invoice ${p.invoiceId} was not found, so the payment was not saved.`);
    }
    if (p.quoteId && !quoteUuid) {
      throw new Error(`Quotation ${p.quoteId} was not found, so the payment was not saved.`);
    }

    let customerUuid: string | null = null;
    if (p.customerId) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq(...idFilter(p.customerId))
        .maybeSingle();
      customerUuid = data?.id ?? null;
    }

    const payload = {
      customer_id: customerUuid,
      invoice_id: invoiceUuid,
      quotation_id: quoteUuid,
      amount: p.amount,
      currency_code: p.currencyCode,
      paid_on: toDate(p.date),
      method: p.method,
      reference: p.reference ?? null,
      notes: p.notes ?? null,
    };

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq(...idFilter(p.id))
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("payments").update(applyDefaults("payments", payload)).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("payments")
        .insert(applyDefaults("payments", { ...payload, legacy_id: isUuid(p.id) ? null : p.id }));
      if (error) throw new Error(error.message);
    }
    return p;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("payments").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

type ProductRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  price: number | string;
  description: string | null;
};

export const ProductRepo = {
  async list(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("id, legacy_id, name, price, description")
      .order("name");
    if (error) throw new Error(error.message);
    return (data as ProductRow[]).map((row) => ({
      id: appId(row),
      name: row.name,
      price: Number(row.price),
      description: row.description ?? undefined,
    }));
  },

  async upsert(p: Product): Promise<Product> {
    const payload = {
      name: p.name,
      price: p.price,
      description: p.description ?? null,
    };
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq(...idFilter(p.id))
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("products")
        .update(applyDefaults("products", payload))
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("products")
        .insert(applyDefaults("products", { ...payload, legacy_id: isUuid(p.id) ? null : p.id }));
      if (error) throw new Error(error.message);
    }
    return p;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

type ExpenseRow = {
  id: string;
  legacy_id: string | null;
  vendor: string;
  category: string | null;
  amount: number | string;
  tax: number | string | null;
  currency_code: string;
  spent_on: string | null;
  notes: string | null;
  created_at: string;
};

export const ExpenseRepo = {
  async list(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, legacy_id, vendor, category, amount, tax, currency_code, spent_on, notes, created_at")
      .order("spent_on", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ExpenseRow[]).map((row) => ({
      id: appId(row),
      vendor: row.vendor,
      category: row.category ?? "",
      amount: Number(row.amount),
      tax: row.tax === null ? undefined : Number(row.tax),
      currencyCode: row.currency_code,
      date: toIso(row.spent_on) ?? row.created_at,
      notes: row.notes ?? undefined,
    }));
  },

  async upsert(e: Expense): Promise<Expense> {
    // receiptDataUrl is deliberately not persisted. It was a base64 image
    // inlined into the row; receipts belong in the expense-receipts storage
    // bucket, which the file_storage migration created for the purpose.
    const payload = {
      vendor: e.vendor,
      category: e.category || null,
      amount: e.amount,
      tax: e.tax ?? null,
      currency_code: e.currencyCode || null,
      spent_on: toDate(e.date),
      notes: e.notes ?? null,
    };
    const { data: existing } = await supabase
      .from("expenses")
      .select("id")
      .eq(...idFilter(e.id))
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("expenses")
        .update(applyDefaults("expenses", payload))
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("expenses")
        .insert(applyDefaults("expenses", { ...payload, legacy_id: isUuid(e.id) ? null : e.id }));
      if (error) throw new Error(error.message);
    }
    return e;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("expenses").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

type SaleRow = {
  id: string;
  legacy_id: string | null;
  number: string;
  customer_id: string | null;
  customer_name: string | null;
  sold_on: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  items: SaleItem[] | null;
  created_at: string;
};

const SALE_COLUMNS =
  "id, legacy_id, number, customer_id, customer_name, sold_on, method, reference, notes, items, created_at";

export const SaleRepo = {
  async list(): Promise<Sale[]> {
    const [{ data, error }, { data: customers }] = await Promise.all([
      supabase.from("sales").select(SALE_COLUMNS).order("sold_on", { ascending: false }),
      supabase.from("customers").select("id, legacy_id"),
    ]);
    if (error) throw new Error(error.message);

    const customerIds = new Map<string, string>();
    for (const c of (customers ?? []) as { id: string; legacy_id: string | null }[]) {
      customerIds.set(c.id, c.legacy_id ?? c.id);
    }

    return (data as SaleRow[]).map((row) => ({
      id: appId(row),
      number: row.number,
      date: (toIso(row.sold_on) ?? row.created_at).slice(0, 10),
      customerId: row.customer_id ? customerIds.get(row.customer_id) ?? row.customer_id : undefined,
      customerName: row.customer_name ?? undefined,
      items: row.items ?? [],
      method: row.method ?? undefined,
      reference: row.reference ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
    }));
  },

  async upsert(s: Sale): Promise<Sale> {
    let customerUuid: string | null = null;
    if (s.customerId) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq(...idFilter(s.customerId))
        .maybeSingle();
      customerUuid = data?.id ?? null;
    }

    // Items stay denormalised, matching the column the schema provides. A sale
    // is a till receipt: it records what was sold at that moment and is not
    // edited line by line the way an invoice is.
    const payload = {
      number: s.number,
      customer_id: customerUuid,
      customer_name: s.customerName ?? null,
      sold_on: toDate(s.date),
      method: s.method ?? null,
      reference: s.reference ?? null,
      notes: s.notes ?? null,
      items: s.items ?? [],
    };

    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq(...idFilter(s.id))
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("sales")
        .update(applyDefaults("sales", payload))
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("sales")
        .insert(applyDefaults("sales", { ...payload, legacy_id: isUuid(s.id) ? null : s.id }));
      if (error) throw new Error(error.message);
    }
    return s;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("sales").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Credit notes
//
// Applications live in their own table rather than a jsonb column, because a
// credit applied to an invoice is a financial link that should be joinable and
// constrained, not a blob.
// ---------------------------------------------------------------------------

type CreditNoteRow = {
  id: string;
  legacy_id: string | null;
  number: string;
  customer_id: string | null;
  customer_name: string | null;
  issue_date: string | null;
  amount: number | string;
  notes: string | null;
  created_at: string;
  credit_note_applications: { invoice_id: string; amount: number | string }[];
};

const CREDIT_NOTE_COLUMNS = `
  id, legacy_id, number, customer_id, customer_name, issue_date, amount, notes, created_at,
  credit_note_applications ( invoice_id, amount )
`;

export const CreditNoteRepo = {
  async list(): Promise<CreditNote[]> {
    const [{ data, error }, { data: invoices }, { data: customers }] = await Promise.all([
      supabase.from("credit_notes").select(CREDIT_NOTE_COLUMNS).order("issue_date", { ascending: false }),
      supabase.from("invoices").select("id, legacy_id"),
      supabase.from("customers").select("id, legacy_id"),
    ]);
    if (error) throw new Error(error.message);

    const appIdOf = (rows: { id: string; legacy_id: string | null }[] | null) => {
      const m = new Map<string, string>();
      for (const r of rows ?? []) m.set(r.id, r.legacy_id ?? r.id);
      return m;
    };
    const invoiceIds = appIdOf(invoices);
    const customerIds = appIdOf(customers);

    return (data as unknown as CreditNoteRow[]).map((row) => ({
      id: appId(row),
      number: row.number,
      date: (toIso(row.issue_date) ?? row.created_at).slice(0, 10),
      customerId: row.customer_id ? customerIds.get(row.customer_id) ?? row.customer_id : "",
      customerName: row.customer_name ?? undefined,
      amount: Number(row.amount),
      applied: (row.credit_note_applications ?? []).map((a) => ({
        invoiceId: invoiceIds.get(a.invoice_id) ?? a.invoice_id,
        amount: Number(a.amount),
      })),
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
    }));
  },

  async upsert(cn: CreditNote): Promise<CreditNote> {
    let customerUuid: string | null = null;
    if (cn.customerId) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq(...idFilter(cn.customerId))
        .maybeSingle();
      customerUuid = data?.id ?? null;
    }

    const payload = {
      number: cn.number,
      customer_id: customerUuid,
      customer_name: cn.customerName ?? null,
      issue_date: toDate(cn.date),
      amount: cn.amount,
      notes: cn.notes ?? null,
    };

    const { data: existing } = await supabase
      .from("credit_notes")
      .select("id")
      .eq(...idFilter(cn.id))
      .maybeSingle();

    let uuid: string;
    if (existing) {
      const { error } = await supabase
        .from("credit_notes")
        .update(applyDefaults("credit_notes", payload))
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      uuid = existing.id;
    } else {
      const { data, error } = await supabase
        .from("credit_notes")
        .insert(applyDefaults("credit_notes", { ...payload, legacy_id: isUuid(cn.id) ? null : cn.id }))
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      uuid = data.id;
    }

    await this.replaceApplications(uuid, cn.applied ?? []);
    return cn;
  },

  /** Replaces the credit's applications, resolving invoice ids to uuids. */
  async replaceApplications(creditNoteUuid: string, applied: CreditApply[]): Promise<void> {
    const { error: delError } = await supabase
      .from("credit_note_applications")
      .delete()
      .eq("credit_note_id", creditNoteUuid);
    if (delError) throw new Error(delError.message);
    if (applied.length === 0) return;

    const rows: { credit_note_id: string; invoice_id: string; amount: number }[] = [];
    for (const a of applied) {
      const invoiceUuid = await InvoiceRepo.uuidFor(a.invoiceId);
      // Refuse rather than drop the link. A credit recorded against nothing
      // would leave the invoice showing a balance the customer does not owe.
      if (!invoiceUuid) {
        throw new Error(`Invoice ${a.invoiceId} was not found, so the credit was not applied.`);
      }
      rows.push({ credit_note_id: creditNoteUuid, invoice_id: invoiceUuid, amount: a.amount });
    }

    const { error } = await supabase.from("credit_note_applications").insert(rows);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("credit_notes").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Recurring templates
// ---------------------------------------------------------------------------

type RecurringRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  customer_id: string | null;
  customer_snapshot: Customer | null;
  items: RecurringTemplate["items"] | null;
  cadence: string;
  interval_days: number | null;
  start_date: string | null;
  end_date: string | null;
  time_of_day: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  active: boolean;
  auto_send: boolean;
  seq_prefix: string | null;
  next_number: number | null;
  notes: string | null;
  created_at: string;
};

const RECURRING_COLUMNS = `
  id, legacy_id, name, customer_id, customer_snapshot, items, cadence, interval_days,
  start_date, end_date, time_of_day, next_run_at, last_run_at, active, auto_send,
  seq_prefix, next_number, notes, created_at
`;

export const RecurringRepo = {
  async list(): Promise<RecurringTemplate[]> {
    const { data, error } = await supabase
      .from("recurring_templates")
      .select(RECURRING_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data as unknown as RecurringRow[]).map((row) => ({
      id: appId(row),
      name: row.name,
      customer: (row.customer_snapshot ?? { id: "", name: "" }) as Customer,
      items: row.items ?? [],
      cadence: row.cadence as RecurringTemplate["cadence"],
      intervalDays: row.interval_days ?? undefined,
      startDate: row.start_date ?? "",
      endDate: row.end_date ?? undefined,
      timeOfDay: row.time_of_day ?? undefined,
      nextRunAt: row.next_run_at ?? "",
      lastRunAt: row.last_run_at ?? undefined,
      active: row.active,
      autoSend: row.auto_send,
      seqPrefix: row.seq_prefix ?? undefined,
      nextNumber: row.next_number ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
    }));
  },

  async upsert(t: RecurringTemplate): Promise<RecurringTemplate> {
    const customerId = t.customer?.id ? await CustomerRepo.ensure(t.customer) : null;

    const payload = {
      name: t.name,
      customer_id: customerId,
      customer_snapshot: t.customer ?? null,
      items: t.items ?? [],
      cadence: t.cadence,
      interval_days: t.intervalDays ?? null,
      start_date: t.startDate || null,
      end_date: t.endDate ?? null,
      time_of_day: t.timeOfDay ?? null,
      next_run_at: t.nextRunAt || null,
      last_run_at: t.lastRunAt ?? null,
      active: t.active,
      auto_send: t.autoSend,
      seq_prefix: t.seqPrefix ?? null,
      next_number: t.nextNumber ?? null,
      notes: t.notes ?? null,
    };

    const { data: existing } = await supabase
      .from("recurring_templates")
      .select("id")
      .eq(...idFilter(t.id))
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("recurring_templates")
        .update(applyDefaults("recurring_templates", payload))
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("recurring_templates")
        .insert(applyDefaults("recurring_templates", { ...payload, legacy_id: isUuid(t.id) ? null : t.id }));
      if (error) throw new Error(error.message);
    }
    return t;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("recurring_templates").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

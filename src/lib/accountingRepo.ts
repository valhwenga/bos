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

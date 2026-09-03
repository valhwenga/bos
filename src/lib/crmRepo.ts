/**
 * Postgres reads and writes for CRM.
 *
 * Leads, deals, customers and tasks were localStorage arrays, so a pipeline was
 * only ever visible to the person who built it — which for a sales tool is
 * close to useless.
 *
 * Activities on a lead and comments on a deal stay denormalised on the row.
 * They are short notes, always read with the thing they belong to, and never
 * queried across records.
 */

import { supabase } from "./supabase";
import type { Lead, LeadActivity } from "./crmLeadsStore";
import type { Deal, DealComment } from "./crmDealsStore";
import type { CrmCustomer, ContactPerson } from "./crmCustomersStore";
import type { CrmTask } from "./crmTasksStore";

const appId = (row: { id: string; legacy_id: string | null }) => row.legacy_id ?? row.id;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);
const idFilter = (v: string): [string, string] => (isUuid(v) ? ["id", v] : ["legacy_id", v]);
/** Owner and assignee columns are uuids; older records held other ids. */
const asProfileId = (v?: string) => (v && isUuid(v) ? v : null);

async function appIdMap(table: string): Promise<Map<string, string>> {
  const { data } = await supabase.from(table).select("id, legacy_id");
  const m = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; legacy_id: string | null }[]) {
    m.set(r.id, r.legacy_id ?? r.id);
  }
  return m;
}

async function uuidFor(table: string, id?: string): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq(...idFilter(id))
    .maybeSingle();
  return data?.id ?? null;
}

/** The database uuid for a lead's app id, for tables keyed by uuid. */
export async function leadUuid(id: string): Promise<string | null> {
  return uuidFor("leads", id);
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

const LEAD_COLUMNS =
  "id, legacy_id, name, company, email, phone, address, stage, source, owner_id, activities, created_at";

export const LeadRepo = {
  async list(): Promise<Lead[]> {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      name: row.name as string,
      company: (row.company as string) ?? undefined,
      email: (row.email as string) ?? undefined,
      phone: (row.phone as string) ?? undefined,
      address: (row.address as string) ?? undefined,
      stage: (row.stage as Lead["stage"]) ?? "new",
      source: (row.source as Lead["source"]) ?? undefined,
      ownerId: (row.owner_id as string) ?? undefined,
      activities: ((row.activities as LeadActivity[]) ?? []),
      // Attachments are files in the lead-attachments bucket now, not base64 on
      // the row; the CRM screens read them through the attachments table.
      attachments: [],
      createdAt: row.created_at as string,
    }));
  },

  async upsert(l: Lead): Promise<Lead> {
    const payload = {
      name: l.name,
      company: l.company ?? null,
      email: l.email ?? null,
      phone: l.phone ?? null,
      address: l.address ?? null,
      stage: l.stage ?? "new",
      source: l.source ?? null,
      owner_id: asProfileId(l.ownerId),
      activities: l.activities ?? [],
    };
    const existing = await uuidFor("leads", l.id);
    if (existing) {
      const { error } = await supabase.from("leads").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("leads")
        .insert({ ...payload, legacy_id: isUuid(l.id) ? null : l.id });
      if (error) throw new Error(error.message);
    }
    return l;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("leads").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

const DEAL_COLUMNS =
  "id, legacy_id, title, crm_customer_id, lead_id, value, probability, expected_close, stage, owner_id, comments, created_at, updated_at";

export const DealRepo = {
  async list(): Promise<Deal[]> {
    const [{ data, error }, customerIds, leadIds] = await Promise.all([
      supabase.from("deals").select(DEAL_COLUMNS).order("created_at", { ascending: false }),
      appIdMap("crm_customers"),
      appIdMap("leads"),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      title: row.title as string,
      customerId: row.crm_customer_id
        ? customerIds.get(row.crm_customer_id as string) ?? (row.crm_customer_id as string)
        : undefined,
      leadId: row.lead_id ? leadIds.get(row.lead_id as string) ?? (row.lead_id as string) : undefined,
      value: Number(row.value ?? 0),
      probability: Number(row.probability ?? 0),
      expectedClose: (row.expected_close as string) ?? undefined,
      stage: (row.stage as Deal["stage"]) ?? "negotiation",
      ownerId: (row.owner_id as string) ?? undefined,
      comments: ((row.comments as DealComment[]) ?? []),
      createdAt: row.created_at as string,
      updatedAt: (row.updated_at as string) ?? undefined,
    }));
  },

  async upsert(d: Deal): Promise<Deal> {
    const [customerUuid, leadUuid] = await Promise.all([
      uuidFor("crm_customers", d.customerId),
      uuidFor("leads", d.leadId),
    ]);

    const payload = {
      title: d.title,
      crm_customer_id: customerUuid,
      lead_id: leadUuid,
      value: d.value ?? 0,
      probability: d.probability ?? 0,
      expected_close: d.expectedClose ? new Date(d.expectedClose).toISOString().slice(0, 10) : null,
      stage: d.stage ?? "negotiation",
      owner_id: asProfileId(d.ownerId),
      comments: d.comments ?? [],
    };

    const existing = await uuidFor("deals", d.id);
    if (existing) {
      const { error } = await supabase.from("deals").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, legacy_id: isUuid(d.id) ? null : d.id });
      if (error) throw new Error(error.message);
    }
    return d;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("deals").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// CRM customers
//
// Distinct from the accounting `customers` table: this is the relationship
// record, with its contact people, rather than who an invoice is billed to.
// ---------------------------------------------------------------------------

export const CrmCustomerRepo = {
  async list(): Promise<CrmCustomer[]> {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("id, legacy_id, name, address, contacts, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      name: row.name as string,
      address: (row.address as string) ?? undefined,
      contacts: ((row.contacts as ContactPerson[]) ?? []),
      createdAt: row.created_at as string,
    }));
  },

  async upsert(c: CrmCustomer): Promise<CrmCustomer> {
    const payload = {
      name: c.name,
      address: c.address ?? null,
      contacts: c.contacts ?? [],
    };
    const existing = await uuidFor("crm_customers", c.id);
    if (existing) {
      const { error } = await supabase.from("crm_customers").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("crm_customers")
        .insert({ ...payload, legacy_id: isUuid(c.id) ? null : c.id });
      if (error) throw new Error(error.message);
    }
    return c;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("crm_customers").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// CRM tasks
//
// A task hangs off either a lead or a deal. The column keeps the *app's* id for
// that record rather than a uuid, because it can point at either table and a
// foreign key cannot.
// ---------------------------------------------------------------------------

export const CrmTaskRepo = {
  async list(): Promise<CrmTask[]> {
    const { data, error } = await supabase
      .from("crm_tasks")
      .select("id, legacy_id, title, description, entity_type, entity_legacy_id, assignee_id, due_at, priority, completed, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      title: row.title as string,
      description: (row.description as string) ?? undefined,
      entityType: (row.entity_type as CrmTask["entityType"]) ?? "lead",
      entityId: (row.entity_legacy_id as string) ?? "",
      assigneeId: (row.assignee_id as string) ?? undefined,
      dueAt: (row.due_at as string) ?? undefined,
      priority: (row.priority as CrmTask["priority"]) ?? "medium",
      completed: Boolean(row.completed),
      createdAt: row.created_at as string,
    }));
  },

  async upsert(t: CrmTask): Promise<CrmTask> {
    const payload = {
      title: t.title,
      description: t.description ?? null,
      entity_type: t.entityType,
      entity_legacy_id: t.entityId,
      assignee_id: asProfileId(t.assigneeId),
      due_at: t.dueAt ?? null,
      priority: t.priority ?? "medium",
      completed: t.completed ?? false,
    };
    const existing = await uuidFor("crm_tasks", t.id);
    if (existing) {
      const { error } = await supabase.from("crm_tasks").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("crm_tasks")
        .insert({ ...payload, legacy_id: isUuid(t.id) ? null : t.id });
      if (error) throw new Error(error.message);
    }
    return t;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("crm_tasks").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

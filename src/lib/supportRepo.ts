/**
 * Postgres reads and writes for Support, Clients and Performance reviews.
 *
 * Tickets in particular were per-browser, which for a support queue means an
 * agent could not see what a colleague had already answered, and a customer's
 * ticket existed only on whichever machine took it.
 */

import { supabase } from "./supabase";
import type { CannedResponse, SupportSettings, Ticket, Comment } from "./supportStore";
import type { Client } from "./clientsStore";
import type { Performance } from "./hrmPerformanceStore";

const appId = (row: { id: string; legacy_id: string | null }) => row.legacy_id ?? row.id;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);
const idFilter = (v: string): [string, string] => (isUuid(v) ? ["id", v] : ["legacy_id", v]);
const asUuid = (v?: string) => (v && isUuid(v) ? v : null);

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

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

const TICKET_COLUMNS =
  "id, legacy_id, reference, title, description, client_id, requester, requester_email, inbox_address, department_id, assignee_id, category, priority, status, first_response_at, resolved_at, due_at, comments, closure_request, approval, created_at, updated_at";

export const TicketRepo = {
  async list(): Promise<Ticket[]> {
    const [{ data, error }, clientIds, departmentIds] = await Promise.all([
      supabase.from("tickets").select(TICKET_COLUMNS).order("created_at", { ascending: false }),
      appIdMap("clients"),
      appIdMap("departments"),
    ]);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      reference: (row.reference as string) ?? undefined,
      title: row.title as string,
      description: (row.description as string) ?? "",
      clientId: row.client_id ? clientIds.get(row.client_id as string) ?? (row.client_id as string) : undefined,
      requester: (row.requester as string) ?? "",
      requesterEmail: (row.requester_email as string) ?? undefined,
      inboxAddress: (row.inbox_address as string) ?? undefined,
      departmentId: row.department_id
        ? departmentIds.get(row.department_id as string) ?? (row.department_id as string)
        : undefined,
      assigneeId: (row.assignee_id as string) ?? undefined,
      category: (row.category as string) ?? undefined,
      priority: (row.priority as Ticket["priority"]) ?? "medium",
      status: (row.status as Ticket["status"]) ?? "open",
      createdAt: row.created_at as string,
      updatedAt: (row.updated_at as string) ?? (row.created_at as string),
      firstResponseAt: (row.first_response_at as string) ?? undefined,
      resolvedAt: (row.resolved_at as string) ?? undefined,
      dueAt: (row.due_at as string) ?? undefined,
      comments: ((row.comments as Comment[]) ?? []),
      // Attachments are files in the ticket-attachments bucket now.
      attachments: [],
      closureRequest: (row.closure_request as Ticket["closureRequest"]) ?? null,
      approval: (row.approval as Ticket["approval"]) ?? null,
    }));
  },

  async upsert(t: Ticket): Promise<Ticket> {
    const [clientUuid, departmentUuid] = await Promise.all([
      uuidFor("clients", t.clientId),
      uuidFor("departments", t.departmentId),
    ]);

    const payload = {
      title: t.title,
      description: t.description ?? "",
      client_id: clientUuid,
      requester: t.requester ?? "",
      department_id: departmentUuid,
      assignee_id: asUuid(t.assigneeId),
      category: t.category ?? null,
      priority: t.priority ?? "medium",
      status: t.status ?? "open",
      first_response_at: t.firstResponseAt ?? null,
      resolved_at: t.resolvedAt ?? null,
      due_at: t.dueAt ?? null,
      comments: t.comments ?? [],
      closure_request: t.closureRequest ?? null,
      approval: t.approval ?? null,
    };

    const existing = await uuidFor("tickets", t.id);
    if (existing) {
      const { error } = await supabase.from("tickets").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("tickets")
        .insert({ ...payload, legacy_id: isUuid(t.id) ? null : t.id });
      if (error) throw new Error(error.message);
    }
    return t;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("tickets").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },

  /** The uuid for a ticket's app id, for attaching files to it. */
  uuidFor(id: string): Promise<string | null> {
    return uuidFor("tickets", id);
  },
};

// ---------------------------------------------------------------------------
// Support settings and canned responses
// ---------------------------------------------------------------------------

export const SupportSettingsRepo = {
  async get(): Promise<SupportSettings> {
    const { data, error } = await supabase
      .from("support_settings")
      .select("categories, sla_low, sla_medium, sla_high, sla_urgent")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      categories: (data?.categories as string[]) ?? [],
      slaTargets: {
        low: Number(data?.sla_low ?? 72),
        medium: Number(data?.sla_medium ?? 48),
        high: Number(data?.sla_high ?? 24),
        urgent: Number(data?.sla_urgent ?? 4),
      },
    };
  },

  async update(s: SupportSettings): Promise<SupportSettings> {
    const { data, error } = await supabase
      .from("support_settings")
      .update({
        categories: s.categories ?? [],
        sla_low: s.slaTargets.low,
        sla_medium: s.slaTargets.medium,
        sla_high: s.slaTargets.high,
        sla_urgent: s.slaTargets.urgent,
      })
      .eq("id", true)
      .select("categories");
    if (error) throw new Error(error.message);
    // A filtered update returns no rows and no error, so the caller would
    // otherwise be told it saved.
    if (!data || data.length === 0) {
      throw new Error("You need full access to support to change these settings.");
    }
    return s;
  },
};

export const CannedResponseRepo = {
  async list(): Promise<CannedResponse[]> {
    const { data, error } = await supabase
      .from("canned_responses")
      .select("id, legacy_id, title, body")
      .order("title");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      title: row.title as string,
      body: row.body as string,
    }));
  },

  /** Replaces the whole set, matching how the settings screen edits them. */
  async replaceAll(list: CannedResponse[]): Promise<CannedResponse[]> {
    const { error: delError } = await supabase
      .from("canned_responses")
      .delete()
      .not("id", "is", null);
    if (delError) throw new Error(delError.message);
    if (list.length === 0) return list;

    const { error } = await supabase.from("canned_responses").insert(
      list.map((c) => ({
        legacy_id: isUuid(c.id) ? null : c.id,
        title: c.title,
        body: c.body,
      })),
    );
    if (error) throw new Error(error.message);
    return list;
  },
};

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const ClientRepo = {
  async list(): Promise<Client[]> {
    const { data, error } = await supabase
      .from("clients")
      .select("id, legacy_id, name, email, company, phone, status, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      name: row.name as string,
      email: (row.email as string) ?? undefined,
      company: (row.company as string) ?? undefined,
      phone: (row.phone as string) ?? undefined,
      status: (row.status as Client["status"]) ?? "active",
      createdAt: row.created_at as string,
    }));
  },

  async upsert(c: Client): Promise<Client> {
    const payload = {
      name: c.name,
      email: c.email ?? null,
      company: c.company ?? null,
      phone: c.phone ?? null,
      status: c.status ?? "active",
    };
    const existing = await uuidFor("clients", c.id);
    if (existing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("clients")
        .insert({ ...payload, legacy_id: isUuid(c.id) ? null : c.id });
      if (error) throw new Error(error.message);
    }
    return c;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("clients").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Performance reviews
// ---------------------------------------------------------------------------

export const PerformanceRepo = {
  async list(): Promise<Performance[]> {
    const [{ data, error }, employeeIds] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select(
          "id, legacy_id, employee_id, employee_name, department, rating, goals_completed, total_goals, attendance_pct, productivity_pct, status, review_date",
        )
        .order("review_date", { ascending: false }),
      appIdMap("employees"),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      employeeId: row.employee_id
        ? employeeIds.get(row.employee_id as string) ?? (row.employee_id as string)
        : "",
      employee: (row.employee_name as string) ?? "",
      department: (row.department as string) ?? "",
      rating: Number(row.rating ?? 0),
      goalsCompleted: Number(row.goals_completed ?? 0),
      totalGoals: Number(row.total_goals ?? 0),
      attendance: Number(row.attendance_pct ?? 0),
      productivity: Number(row.productivity_pct ?? 0),
      status: (row.status as Performance["status"]) ?? "Average",
      reviewDate: (row.review_date as string) ?? "",
    }));
  },

  async upsert(p: Performance): Promise<Performance> {
    const employeeUuid = await uuidFor("employees", p.employeeId);

    const payload = {
      employee_id: employeeUuid,
      employee_name: p.employee ?? null,
      department: p.department ?? null,
      rating: p.rating ?? 0,
      goals_completed: p.goalsCompleted ?? 0,
      total_goals: p.totalGoals ?? 0,
      attendance_pct: p.attendance ?? 0,
      productivity_pct: p.productivity ?? 0,
      status: p.status ?? "Average",
      review_date: p.reviewDate ? new Date(p.reviewDate).toISOString().slice(0, 10) : null,
    };

    const existing = await uuidFor("performance_reviews", p.id);
    if (existing) {
      const { error } = await supabase.from("performance_reviews").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("performance_reviews")
        .insert({ ...payload, legacy_id: isUuid(p.id) ? null : p.id });
      if (error) throw new Error(error.message);
    }
    return p;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("performance_reviews").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

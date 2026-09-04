/**
 * Postgres reads and writes for Projects.
 *
 * Projects, tasks, time entries, bugs, types and calendar events were all
 * localStorage arrays, so a project assigned on one machine did not exist on
 * any other and a bug raised against it was visible only to whoever raised it.
 *
 * As elsewhere, rows keep their original id in `legacy_id` and the app keeps
 * using it, so links held between records still resolve.
 */

import { supabase } from "./supabase";
import type {
  Bug,
  CalendarEvent,
  Project,
  ProjectType,
  Task,
  TimeEntry,
} from "./projectStore";

const appId = (row: { id: string; legacy_id: string | null }) => row.legacy_id ?? row.id;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);
const idFilter = (v: string): [string, string] => (isUuid(v) ? ["id", v] : ["legacy_id", v]);

const iso = (v: string | null): string | undefined => v ?? undefined;
const dateOnly = (v?: string | null): string | null =>
  v ? new Date(v).toISOString().slice(0, 10) : null;

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
// Project types
// ---------------------------------------------------------------------------

export const ProjectTypeRepo = {
  async list(): Promise<ProjectType[]> {
    const { data, error } = await supabase
      .from("project_types")
      .select("key, label, allowed_role_ids, allowed_user_ids")
      .order("label");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      key: row.key as string,
      label: row.label as string,
      allowedRoleIds: (row.allowed_role_ids as string[]) ?? [],
      allowedUserIds: (row.allowed_user_ids as string[]) ?? [],
    }));
  },

  async upsert(t: ProjectType): Promise<ProjectType> {
    const { error } = await supabase.from("project_types").upsert(
      {
        key: t.key,
        label: t.label,
        allowed_role_ids: t.allowedRoleIds ?? [],
        // Only real uuids: the app once held role ids here too, and a
        // non-uuid would be rejected by the column type.
        allowed_user_ids: (t.allowedUserIds ?? []).filter(isUuid),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return t;
  },
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

type ProjectRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  description: string | null;
  client_id: string | null;
  customer_id: string | null;
  type_key: string | null;
  assigned_to: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  due_at: string | null;
  milestones: Project["milestones"] | null;
  comments: Project["comments"] | null;
  supervisor_role: string | null;
  assigned_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  closed_at: string | null;
  approved_by: string | null;
  approval_note: string | null;
  rejection_reason: string | null;
  created_at: string;
};

const PROJECT_COLUMNS =
  "id, legacy_id, name, description, client_id, customer_id, type_key, assigned_to, status, start_date, end_date, due_at, milestones, comments, supervisor_role, assigned_at, submitted_at, approved_at, closed_at, approved_by, approval_note, rejection_reason, created_at";

const toProject = (row: ProjectRow, clientIds: Map<string, string>): Project => ({
  id: appId(row),
  name: row.name,
  description: row.description ?? undefined,
  clientId: row.client_id ? clientIds.get(row.client_id) ?? row.client_id : undefined,
  customerId: row.customer_id ?? undefined,
  typeKey: row.type_key ?? undefined,
  assignedToUserId: row.assigned_to ?? undefined,
  supervisorRole: (row.supervisor_role as Project["supervisorRole"]) ?? undefined,
  status: (row.status as Project["status"]) ?? undefined,
  dueAt: iso(row.due_at),
  startDate: iso(row.start_date),
  endDate: iso(row.end_date),
  milestones: row.milestones ?? [],
  comments: row.comments ?? [],
  createdAt: row.created_at,
  assignedAt: iso(row.assigned_at),
  submittedAt: iso(row.submitted_at),
  approvedAt: iso(row.approved_at),
  closedAt: iso(row.closed_at),
  approvedByUserId: row.approved_by ?? undefined,
  approvalNote: row.approval_note ?? undefined,
  rejectionReason: row.rejection_reason ?? undefined,
});

export const ProjectRepo = {
  async list(): Promise<Project[]> {
    const [{ data, error }, clientIds] = await Promise.all([
      supabase.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }),
      appIdMap("clients"),
    ]);
    if (error) throw new Error(error.message);
    return (data as ProjectRow[]).map((row) => toProject(row, clientIds));
  },

  async upsert(p: Project): Promise<Project> {
    const clientUuid = await uuidFor("clients", p.clientId);

    const payload = {
      name: p.name,
      description: p.description ?? null,
      client_id: clientUuid,
      customer_id: null as string | null,
      type_key: p.typeKey ?? null,
      // Profile ids are already uuids; anything else predates the auth move.
      assigned_to: p.assignedToUserId && isUuid(p.assignedToUserId) ? p.assignedToUserId : null,
      supervisor_role: p.supervisorRole ?? null,
      status: p.status ?? "open",
      start_date: dateOnly(p.startDate),
      end_date: dateOnly(p.endDate),
      due_at: p.dueAt ?? null,
      milestones: p.milestones ?? [],
      comments: p.comments ?? [],
      assigned_at: p.assignedAt ?? null,
      submitted_at: p.submittedAt ?? null,
      approved_at: p.approvedAt ?? null,
      closed_at: p.closedAt ?? null,
      approved_by: p.approvedByUserId && isUuid(p.approvedByUserId) ? p.approvedByUserId : null,
      approval_note: p.approvalNote ?? null,
      rejection_reason: p.rejectionReason ?? null,
    };

    const existing = await uuidFor("projects", p.id);
    if (existing) {
      const { error } = await supabase.from("projects").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("projects")
        .insert({ ...payload, legacy_id: isUuid(p.id) ? null : p.id });
      if (error) throw new Error(error.message);
    }
    return p;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("projects").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

type TaskRow = {
  id: string;
  legacy_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  updates: Task["updates"] | null;
};

export const TaskRepo = {
  async list(): Promise<Task[]> {
    const [{ data, error }, projectIds] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("id, legacy_id, project_id, title, description, status, assigned_to, due_at, updates")
        .order("created_at", { ascending: false }),
      appIdMap("projects"),
    ]);
    if (error) throw new Error(error.message);
    return (data as TaskRow[]).map((row) => ({
      id: appId(row),
      projectId: row.project_id ? projectIds.get(row.project_id) ?? row.project_id : "",
      title: row.title,
      description: row.description ?? undefined,
      status: (row.status as Task["status"]) ?? "todo",
      assignedToUserId: row.assigned_to ?? undefined,
      dueAt: iso(row.due_at),
      updates: row.updates ?? [],
    }));
  },

  async upsert(t: Task): Promise<Task> {
    const projectUuid = await uuidFor("projects", t.projectId);
    if (t.projectId && !projectUuid) {
      // Better than silently filing the task under nothing, where it would
      // vanish from the project board it was created on.
      throw new Error(`Project ${t.projectId} was not found, so the task was not saved.`);
    }

    const payload = {
      project_id: projectUuid,
      title: t.title,
      description: t.description ?? null,
      status: t.status ?? "todo",
      assigned_to: t.assignedToUserId && isUuid(t.assignedToUserId) ? t.assignedToUserId : null,
      due_at: t.dueAt ?? null,
      updates: t.updates ?? [],
    };

    const existing = await uuidFor("project_tasks", t.id);
    if (existing) {
      const { error } = await supabase.from("project_tasks").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("project_tasks")
        .insert({ ...payload, legacy_id: isUuid(t.id) ? null : t.id });
      if (error) throw new Error(error.message);
    }
    return t;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("project_tasks").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Time entries
//
// The app measures in seconds; the column is hours, because that is what a
// timesheet and an invoice are denominated in.
// ---------------------------------------------------------------------------

export const TimeEntryRepo = {
  async list(): Promise<TimeEntry[]> {
    const [{ data, error }, projectIds, taskIds] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id, legacy_id, project_id, task_id, hours, work_date, created_at")
        .order("work_date", { ascending: false }),
      appIdMap("projects"),
      appIdMap("project_tasks"),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      projectId: row.project_id ? projectIds.get(row.project_id) ?? row.project_id : "",
      taskId: row.task_id ? taskIds.get(row.task_id) ?? row.task_id : undefined,
      seconds: Math.round(Number(row.hours ?? 0) * 3600),
      startedAt: (row.created_at as string) ?? new Date().toISOString(),
    }));
  },

  async add(te: TimeEntry): Promise<TimeEntry> {
    const [projectUuid, taskUuid] = await Promise.all([
      uuidFor("projects", te.projectId),
      uuidFor("project_tasks", te.taskId),
    ]);
    const { error } = await supabase.from("time_entries").insert({
      legacy_id: isUuid(te.id) ? null : te.id,
      project_id: projectUuid,
      task_id: taskUuid,
      hours: te.seconds / 3600,
      work_date: dateOnly(te.startedAt) ?? new Date().toISOString().slice(0, 10),
    });
    if (error) throw new Error(error.message);
    return te;
  },
};

// ---------------------------------------------------------------------------
// Bugs
// ---------------------------------------------------------------------------

export const BugRepo = {
  async list(): Promise<Bug[]> {
    const [{ data, error }, projectIds] = await Promise.all([
      supabase
        .from("project_bugs")
        .select("id, legacy_id, project_id, title, severity, open")
        .order("created_at", { ascending: false }),
      appIdMap("projects"),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      projectId: row.project_id ? projectIds.get(row.project_id as string) ?? (row.project_id as string) : "",
      title: row.title as string,
      severity: (row.severity as Bug["severity"]) ?? "low",
      open: Boolean(row.open),
    }));
  },

  async upsert(b: Bug): Promise<Bug> {
    const projectUuid = await uuidFor("projects", b.projectId);
    const payload = {
      project_id: projectUuid,
      title: b.title,
      severity: b.severity ?? "low",
      open: b.open,
    };
    const existing = await uuidFor("project_bugs", b.id);
    if (existing) {
      const { error } = await supabase.from("project_bugs").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("project_bugs")
        .insert({ ...payload, legacy_id: isUuid(b.id) ? null : b.id });
      if (error) throw new Error(error.message);
    }
    return b;
  },
};

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

export const CalendarRepo = {
  async list(): Promise<CalendarEvent[]> {
    const [{ data, error }, projectIds] = await Promise.all([
      supabase
        .from("calendar_events")
        .select(
          "id, legacy_id, project_id, event_date, title, starts_at, event_type, description, remind_week, remind_day, remind_hour",
        )
        .order("event_date"),
      appIdMap("projects"),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: appId(row as { id: string; legacy_id: string | null }),
      projectId: row.project_id ? projectIds.get(row.project_id as string) ?? (row.project_id as string) : undefined,
      date: row.event_date as string,
      title: row.title as string,
      startAt: (row.starts_at as string) ?? undefined,
      type: (row.event_type as CalendarEvent["type"]) ?? "other",
      description: (row.description as string) ?? undefined,
      remindWeek: Boolean(row.remind_week),
      remindDay: Boolean(row.remind_day),
      remindHour: Boolean(row.remind_hour),
    }));
  },

  async upsert(ev: CalendarEvent): Promise<CalendarEvent> {
    const projectUuid = await uuidFor("projects", ev.projectId);
    const payload = {
      project_id: projectUuid,
      title: ev.title,
      description: ev.description ?? null,
      event_type: ev.type ?? "other",
      event_date: ev.date,
      starts_at: ev.startAt ?? null,
      remind_week: ev.remindWeek ?? false,
      remind_day: ev.remindDay ?? false,
      remind_hour: ev.remindHour ?? false,
    };
    const existing = await uuidFor("calendar_events", ev.id);
    if (existing) {
      const { error } = await supabase.from("calendar_events").update(payload).eq("id", existing);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("calendar_events")
        .insert({ ...payload, legacy_id: isUuid(ev.id) ? null : ev.id });
      if (error) throw new Error(error.message);
    }
    return ev;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("calendar_events").delete().eq(...idFilter(id));
    if (error) throw new Error(error.message);
  },

  /**
   * Records that a reminder has been raised, and says whether this caller was
   * the one to do it.
   *
   * The unique constraint on reminder_key is what makes that answer reliable:
   * two machines racing both insert, one wins, and the loser is told it was
   * already sent instead of raising a duplicate.
   */
  async claimReminder(reminderKey: string): Promise<boolean> {
    const { error } = await supabase
      .from("calendar_events")
      .insert({
        title: "reminder",
        event_type: "reminder",
        event_date: new Date().toISOString().slice(0, 10),
        reminder_key: reminderKey,
        reminder_sent_at: new Date().toISOString(),
      });
    // 23505 is a unique violation: somebody already claimed it.
    if (error) return error.code !== "23505" ? false : false;
    return true;
  },

  async reminderAlreadySent(reminderKey: string): Promise<boolean> {
    const { data } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("reminder_key", reminderKey)
      .maybeSingle();
    return Boolean(data);
  },
};

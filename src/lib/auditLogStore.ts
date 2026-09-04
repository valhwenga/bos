/**
 * The audit trail.
 *
 * There were two of these, writing the same localStorage key with incompatible
 * shapes — `{ts, actor}` and `{timestamp, userName}` — so the compliance report
 * threw the moment it searched a row written by the other one. Both are now
 * this, and the rows are in Postgres.
 *
 * Three things changed that matter more than the storage:
 *
 * The actor is stamped by the database from the JWT. Call sites used to pass
 * the literal string "admin" or "user", which is a record of what the browser
 * asserted rather than of who acted.
 *
 * The timestamp is the server's. A device with a wrong clock used to put its
 * entries anywhere in the timeline.
 *
 * Nothing can edit or delete an entry — there is no policy and no grant for
 * either. A correction is another entry.
 */

import { supabase } from "./supabase";
import { createCache } from "./collectionCache";
import { getSession } from "./session";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "login"
  | "logout"
  | "export";

export type AuditLog = {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  actorEmail?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details?: string;
};

/** What a caller supplies. Who and when are not theirs to choose. */
export type AuditEntry = {
  action: AuditAction;
  entity: string;
  entityId?: string;
  details?: string;
};

const COLUMNS = "id, at, actor_id, actor_name, actor_email, action, entity, entity_id, details";

async function fetchLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select(COLUMNS)
    .order("at", { ascending: false })
    // A trail with no ceiling is right for storage and wrong for a page. This
    // is the screen's window, not a retention policy.
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    at: row.at as string,
    actorId: (row.actor_id as string) ?? null,
    actorName: (row.actor_name as string) ?? "Unknown",
    actorEmail: (row.actor_email as string) ?? undefined,
    action: row.action as AuditAction,
    entity: row.entity as string,
    entityId: (row.entity_id as string) ?? undefined,
    details: (row.details as string) ?? undefined,
  }));
}

export const auditCache = createCache<AuditLog>(fetchLogs);

export const AuditLogStore = {
  list(): AuditLog[] {
    return auditCache.list();
  },
  load(): Promise<AuditLog[]> {
    return auditCache.ensureLoaded();
  },

  /**
   * Records an action.
   *
   * Deliberately not awaited by most callers: an audit write must not be able
   * to fail the thing it is recording. A failure surfaces through the global
   * rejection reporter rather than vanishing, which is the compromise this
   * makes — the trail can miss an entry, but never silently.
   */
  async append(entry: AuditEntry): Promise<void> {
    // From the in-memory snapshot rather than supabase.auth.getUser(), which
    // would be a network round trip on every recorded action. The server does
    // not trust this value regardless — the trigger overwrites it from the JWT.
    const actorId = getSession().profile?.id;
    if (!actorId) return;

    const { error } = await supabase.from("audit_log").insert({
      // Sent for completeness only. A trigger overwrites it, along with the
      // name and the time, from the JWT — so a client that names somebody else
      // has its claim replaced rather than honoured.
      actor_id: actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? null,
    });
    if (error) throw new Error(`Audit write failed: ${error.message}`);
    void auditCache.refresh();
  },
};

/** CSV of what is currently loaded, for the compliance export. */
export function auditCsv(rows: AuditLog[]): string {
  const headers = ["Time", "Actor", "Email", "Action", "Entity", "Entity ID", "Details"];
  const escape = (value: unknown) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [r.at, r.actorName, r.actorEmail ?? "", r.action, r.entity, r.entityId ?? "", r.details ?? ""]
      .map(escape)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

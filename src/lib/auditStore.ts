/**
 * Audit trail and compliance reports.
 * Stores user actions with timestamps, entities, and details.
 */
export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "login" | "logout" | "export" | "view";

export type AuditEntity = "employee" | "payroll" | "leave" | "performance" | "document" | "user" | "role" | "company_settings";

export type AuditLog = {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
};

const K = { audits: "audit.logs" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => {
  try { window.dispatchEvent(new Event(name)); } catch { void 0; }
};

export const AuditStore = {
  list(): AuditLog[] {
    return r<AuditLog[]>(K.audits, []);
  },
  add(entry: Omit<AuditLog, "id" | "timestamp">) {
    const log: AuditLog = {
      id: `AUD${Date.now()}`,
      timestamp: new Date().toISOString(),
      ipAddress: "unknown", // In production, capture from request
      userAgent: navigator.userAgent,
      ...entry,
    };
    const all = this.list();
    all.unshift(log); // newest first
    // Keep last 2000 entries to avoid localStorage bloat
    if (all.length > 2000) all.splice(2000);
    w(K.audits, all);
    emit("audit.logs-changed");
    return log;
  },
  forEntity(entity: AuditEntity, entityId?: string): AuditLog[] {
    const all = this.list();
    return all.filter(log => log.entity === entity && (!entityId || log.entityId === entityId));
  },
  byUser(userId: string): AuditLog[] {
    return this.list().filter(log => log.userId === userId);
  },
  byDateRange(start: string, end: string): AuditLog[] {
    const all = this.list();
    return all.filter(log => log.timestamp >= start && log.timestamp <= end);
  },
  exportCSV(): string {
    const all = this.list();
    const headers = ["Timestamp", "User", "Action", "Entity", "Entity ID", "Details", "IP Address", "User Agent"];
    const rows = all.map(log => [
      log.timestamp,
      log.userName,
      log.action,
      log.entity,
      log.entityId ?? "",
      log.details ?? "",
      log.ipAddress ?? "",
      log.userAgent ?? "",
    ]);
    const escapeCSV = (val: any) => {
      const s = String(val ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    return [headers, ...rows].map(row => row.map(escapeCSV).join(",")).join("\n");
  },
};

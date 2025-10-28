export type AuditAction = "create" | "update" | "delete" | "login" | "logout";
export type AuditLog = { id: string; ts: string; actor: string; entity: string; entityId?: string; action: AuditAction; details?: string };

const K = { logs: "audit.logs" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const AuditLogStore = {
  list(): AuditLog[] { return r<AuditLog[]>(K.logs, []); },
  append(e: AuditLog) { const all = this.list(); all.unshift(e); w(K.logs, all.slice(0, 1000)); return e; }
};

export type TaskPriority = 'low' | 'medium' | 'high';
export type CrmTask = {
  id: string;
  title: string;
  entityType: 'lead' | 'deal';
  entityId: string;
  dueAt?: string; // ISO
  priority: TaskPriority;
  assigneeId?: string;
  completed?: boolean;
  createdAt: string;
  description?: string;
};

const K = { tasks: 'crm.tasks' };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => { try { window.dispatchEvent(new Event(name)); } catch {} };

export const CrmTasksStore = {
  list(): CrmTask[] { return r<CrmTask[]>(K.tasks, []); },
  upsert(t: CrmTask) { const all = this.list(); const i = all.findIndex(x=> x.id===t.id); if (i>=0) all[i]=t; else all.unshift(t); w(K.tasks, all); emit('crm.tasks-changed'); return t; },
  remove(id: string) { const all = this.list().filter(x=> x.id!==id); w(K.tasks, all); emit('crm.tasks-changed'); },
  get(id: string) { return this.list().find(x=> x.id===id); },
};

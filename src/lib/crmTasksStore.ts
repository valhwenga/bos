/**
 * CRM tasks, each hanging off a lead or a deal. Rows in Postgres now.
 */

import { createCache } from "./collectionCache";
import { CrmTaskRepo } from "./crmRepo";

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

export const crmTasksCache = createCache<CrmTask>(() => CrmTaskRepo.list());

const announce = () => {
  try {
    window.dispatchEvent(new Event("crm.tasks-changed"));
  } catch {
    void 0;
  }
};

export const CrmTasksStore = {
  list(): CrmTask[] {
    return crmTasksCache.list();
  },
  load(): Promise<CrmTask[]> {
    return crmTasksCache.ensureLoaded();
  },
  get(id: string) {
    return this.list().find((x) => x.id === id);
  },
  async upsert(t: CrmTask): Promise<CrmTask> {
    await crmTasksCache.mutate(() => CrmTaskRepo.upsert(t));
    announce();
    return t;
  },
  async remove(id: string): Promise<void> {
    await crmTasksCache.mutate(() => CrmTaskRepo.remove(id));
    announce();
  },
};
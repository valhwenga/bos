/**
 * Departments. Rows in Postgres now.
 */

import { createCache } from "./collectionCache";
import { DepartmentRepo } from "./hrmRepo";

export type Department = {
  id: string;
  name: string;
  head?: string;
  employees?: number;
  description?: string;
  color?: string;
};

export const departmentsCache = createCache<Department>(() => DepartmentRepo.list());

export const HRMDepartmentsStore = {
  list(): Department[] {
    return departmentsCache.list();
  },
  load(): Promise<Department[]> {
    return departmentsCache.ensureLoaded();
  },
  async upsert(d: Department): Promise<Department> {
    await departmentsCache.mutate(() => DepartmentRepo.upsert(d));
    return d;
  },
  async remove(id: string): Promise<void> {
    await departmentsCache.mutate(() => DepartmentRepo.remove(id));
  },
};
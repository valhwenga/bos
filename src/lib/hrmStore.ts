/**
 * Employees. Rows in Postgres now.
 *
 * This holds personal data — home addresses, national ID numbers, next of kin —
 * which was previously sitting in localStorage on whichever machine last opened
 * the HR screens. Access is decided by hrm.employees in row level security.
 *
 * Documents (CV, ID copy, qualifications) are not carried here. They were
 * base64 blobs on the record; they belong in the employee-documents storage
 * bucket, which the file_storage migration created for the purpose.
 */

import { createCache } from "./collectionCache";
import { EmployeeRepo } from "./hrmRepo";

export type EmployeeDocument = {
  name: string;
  type: string;
  size: number;
  dataUrl: string; // stored as base64 data URL for demo/local storage purposes
};

export type Employee = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  department?: string;
  designation?: string;
  joiningDate?: string;
  salary?: string;
  status?: string;
  // personal details
  dob?: string;
  address?: string;
  maritalStatus?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  nationalId?: string;
  // documents
  cv?: EmployeeDocument | null;
  qualifications?: EmployeeDocument | null;
  idCopy?: EmployeeDocument | null;
  otherDocuments?: EmployeeDocument[];
};

export const employeesCache = createCache<Employee>(() => EmployeeRepo.list());

export const HRMStore = {
  list(): Employee[] {
    return employeesCache.list();
  },
  load(): Promise<Employee[]> {
    return employeesCache.ensureLoaded();
  },
  async upsert(e: Employee): Promise<Employee> {
    await employeesCache.mutate(() => EmployeeRepo.upsert(e));
    return e;
  },
  async remove(id: string): Promise<void> {
    await employeesCache.mutate(() => EmployeeRepo.remove(id));
  },
};
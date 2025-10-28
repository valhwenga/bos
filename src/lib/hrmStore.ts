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

const K = {
  employees: "hrm.employees",
};

const read = <T,>(k: string, f: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Employee[] = [
  { id: "EMP001", name: "John Anderson", email: "john.anderson@company.com", phone: "+1 234 567 8901", department: "Engineering", designation: "Senior Developer", joiningDate: "15 Jan 2022", salary: "$85,000", status: "Active" },
  { id: "EMP002", name: "Sarah Williams", email: "sarah.williams@company.com", phone: "+1 234 567 8902", department: "Marketing", designation: "Marketing Manager", joiningDate: "20 Mar 2021", salary: "$75,000", status: "Active" },
];

export const HRMStore = {
  list(): Employee[] { return read<Employee[]>(K.employees, SEED); },
  upsert(e: Employee) {
    const all = this.list();
    const i = all.findIndex(x=>x.id===e.id);
    if (i>=0) all[i] = e; else all.push(e);
    write(K.employees, all);
    return e;
  },
  remove(id: string) {
    const all = this.list().filter(x=> x.id !== id);
    write(K.employees, all);
  },
  migrateDepartmentIds(nameToId: Record<string, string>) {
    const all = this.list();
    let changed = false;
    for (const e of all) {
      if (!e.departmentId && e.department && nameToId[e.department]) {
        e.departmentId = nameToId[e.department];
        changed = true;
      }
    }
    if (changed) write(K.employees, all);
  }
};

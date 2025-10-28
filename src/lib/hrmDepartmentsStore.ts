export type Department = {
  id: string;
  name: string;
  head?: string;
  employees?: number;
  description?: string;
  color?: string;
};

const K = { departments: "hrm.departments" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const SEED: Department[] = [
  { id: "D001", name: "Engineering", head: "John Anderson", employees: 24, description: "Software development and technical infrastructure", color: "bg-blue-500" },
  { id: "D002", name: "Marketing", head: "Sarah Williams", employees: 12, description: "Brand management and digital marketing", color: "bg-purple-500" },
];

export const HRMDepartmentsStore = {
  list(): Department[] { return r<Department[]>(K.departments, SEED); },
  upsert(d: Department) { const all = this.list(); const i = all.findIndex(x=>x.id===d.id); if(i>=0) all[i]=d; else all.push(d); w(K.departments, all); return d; },
  remove(id: string) { const all = this.list().filter(x=> x.id !== id); w(K.departments, all); },
};

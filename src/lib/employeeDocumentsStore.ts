/**
 * Employee document vault: store metadata and optionally base64 content.
 * In production, store files in cloud storage and keep metadata here.
 */
export type EmployeeDocument = {
  id: string;
  employeeId: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
  category: "contract" | "id" | "visa" | "tax" | "other";
  description?: string;
  size?: number;
  url?: string; // In real app: cloud storage URL
  base64?: string; // For demo: small files as base64
};

const K = { docs: "employee.documents" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const emit = (name: string) => {
  try { window.dispatchEvent(new Event(name)); } catch { void 0; }
};

export const EmployeeDocumentsStore = {
  list(): EmployeeDocument[] {
    return r<EmployeeDocument[]>(K.docs, []);
  },
  upsert(doc: EmployeeDocument) {
    const all = this.list();
    const i = all.findIndex(d => d.id === doc.id);
    if (i >= 0) all[i] = doc; else all.push(doc);
    w(K.docs, all);
    emit("employee.documents-changed");
    return doc;
  },
  remove(id: string) {
    const all = this.list();
    const filtered = all.filter(d => d.id !== id);
    w(K.docs, filtered);
    emit("employee.documents-changed");
  },
  forEmployee(employeeId: string): EmployeeDocument[] {
    return this.list().filter(d => d.employeeId === employeeId);
  },
};

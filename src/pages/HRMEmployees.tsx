import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Download, Upload, Eye, Edit, Trash2, Trash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanySettingsStore } from "@/lib/companySettings";
import type { Employee, EmployeeDocument } from "@/lib/hrmStore";

// Simple local HRM store to replace CompanyAwareHRMStore
const LocalHRMStore = {
  list: () => {
    const data = localStorage.getItem('hrm_employees');
    return data ? JSON.parse(data) : [];
  },
  upsert: (employee: any) => {
    const employees = LocalHRMStore.list();
    const index = employees.findIndex((e: any) => e.id === employee.id);
    if (index >= 0) {
      employees[index] = employee;
    } else {
      employees.push(employee);
    }
    localStorage.setItem('hrm_employees', JSON.stringify(employees));
    window.dispatchEvent(new Event('hrm_employees-changed'));
  },
  remove: (id: string) => {
    const employees = LocalHRMStore.list();
    const filtered = employees.filter((e: any) => e.id !== id);
    localStorage.setItem('hrm_employees', JSON.stringify(filtered));
    window.dispatchEvent(new Event('hrm_employees-changed'));
  },
  migrateDepartmentIds: (map: Record<string,string>) => {
    const employees = LocalHRMStore.list();
    let changed = false;
    employees.forEach((emp: any) => {
      if (emp.department && !emp.departmentId && map[emp.department]) {
        emp.departmentId = map[emp.department];
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('hrm_employees', JSON.stringify(employees));
    }
  }
};
import { EmployeeDocumentVault } from "@/components/EmployeeDocumentVault";
import { Textarea } from "@/components/ui/textarea";
import { HRMDepartmentsStore, type Department } from "@/lib/hrmDepartmentsStore";
import { Separator } from "@/components/ui/separator";

const HRMEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>(LocalHRMStore.list());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [form, setForm] = useState<Employee>({ id: "", name: "", status: "Active", cv: null, qualifications: null, idCopy: null, otherDocuments: [] });
  const [departments, setDepartments] = useState<Department[]>(HRMDepartmentsStore.list());
  const [attempted, setAttempted] = useState(false);
  const cs = CompanySettingsStore.get();

  const totalEntries = employees.length;
  const showingFrom = totalEntries === 0 ? 0 : 1;
  const showingTo = totalEntries;

  const refresh = () => setEmployees(LocalHRMStore.list());
  useEffect(()=>{
    // migrate departmentId for existing employees
    const deps = HRMDepartmentsStore.list();
    const map: Record<string,string> = Object.fromEntries(deps.map(d=> [d.name, d.id]));
    LocalHRMStore.migrateDepartmentIds(map);
    refresh();
  }, []);

  const startAdd = () => { setEditing(null); setForm({ id: `EMP${Math.floor(Math.random()*900+100)}`, name: "", status: "Active", cv: null, qualifications: null, idCopy: null, otherDocuments: [] }); setDepartments(HRMDepartmentsStore.list()); setAttempted(false); setOpen(true); };
  const startEdit = (e: Employee) => { setEditing(e); setForm(e); setOpen(true); };
  const remove = (id: string) => {
    const ok = window.confirm("Delete this employee? This action cannot be undone.");
    if (!ok) return;
    LocalHRMStore.remove(id);
    refresh();
  };
  const allRequiredPresent = () => {
    const f = form;
    return Boolean(
      f.id && f.name && f.email && f.phone && f.departmentId && f.designation && f.joiningDate && f.salary &&
      f.dob && f.address && f.maritalStatus && f.emergencyContactName && f.emergencyContactPhone && f.nationalId &&
      (editing ? true : (f.cv && f.qualifications && f.idCopy))
    );
  };
  const save = () => {
    setAttempted(true);
    if (!allRequiredPresent()) return;
    LocalHRMStore.upsert({ ...form });
    setOpen(false);
    refresh();
  };

  const toDoc = (f: File, cb: (d: EmployeeDocument)=> void) => {
    const reader = new FileReader();
    reader.onload = () => {
      cb({ name: f.name, type: f.type, size: f.size, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(f);
  };
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Employees</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-primary">Employees</span>
          </div>
        </div>

        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select defaultValue="10">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries per page</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="search" placeholder="Search employees..." className="pl-9 w-64" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">EMPLOYEE</th>
                <th className="text-left p-4 font-semibold text-sm">CONTACT</th>
                <th className="text-left p-4 font-semibold text-sm">DEPARTMENT</th>
                <th className="text-left p-4 font-semibold text-sm">DESIGNATION</th>
                <th className="text-left p-4 font-semibold text-sm">JOINING DATE</th>
                <th className="text-left p-4 font-semibold text-sm">SALARY</th>
                <th className="text-left p-4 font-semibold text-sm">STATUS</th>
                <th className="text-right p-4 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                          {employee.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-xs text-muted-foreground">{employee.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <p className="text-foreground">{employee.email}</p>
                      <p className="text-muted-foreground">{employee.phone}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{employee.department}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{employee.designation}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{employee.joiningDate}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium">
                      {employee.salary ? `${cs.currencySymbol}${String(employee.salary).replace(/[^0-9.,\s-]/g, "").trim()}` : "-"}
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge 
                      variant={employee.status === "Active" ? "default" : "secondary"}
                      className={employee.status === "Active" ? "bg-primary" : ""}
                    >
                      {employee.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setViewing(employee); setViewOpen(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={()=> startEdit(employee)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={()=> remove(employee.id)}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {showingFrom} to {showingTo} of {totalEntries} entries</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
              1
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Name:</span> {viewing.name}</div>
                <div><span className="text-muted-foreground">ID:</span> {viewing.id}</div>
                <div><span className="text-muted-foreground">Email:</span> {viewing.email || "-"}</div>
                <div><span className="text-muted-foreground">Phone:</span> {viewing.phone || "-"}</div>
                <div><span className="text-muted-foreground">Department:</span> {viewing.department || "-"}</div>
                <div><span className="text-muted-foreground">Designation:</span> {viewing.designation || "-"}</div>
                <div><span className="text-muted-foreground">Joining Date:</span> {viewing.joiningDate || "-"}</div>
                <div><span className="text-muted-foreground">Salary:</span> {viewing.salary ? `${cs.currencySymbol}${String(viewing.salary).replace(/[^0-9.,\s-]/g, "").trim()}` : "-"}</div>
                <div><span className="text-muted-foreground">Status:</span> {viewing.status || "-"}</div>
              </div>

              <div className="grid gap-2">
                <div className="font-medium">Documents</div>
                <div className="grid gap-1">
                  <div>
                    <span className="text-muted-foreground">CV:</span>{" "}
                    {viewing.cv?.dataUrl ? <a className="underline" href={viewing.cv.dataUrl} target="_blank">{viewing.cv.name}</a> : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Qualifications:</span>{" "}
                    {viewing.qualifications?.dataUrl ? <a className="underline" href={viewing.qualifications.dataUrl} target="_blank">{viewing.qualifications.name}</a> : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">ID Copy:</span>{" "}
                    {viewing.idCopy?.dataUrl ? <a className="underline" href={viewing.idCopy.dataUrl} target="_blank">{viewing.idCopy.name}</a> : "-"}
                  </div>
                  {(viewing.otherDocuments || []).length > 0 && (
                    <div className="grid gap-1">
                      <span className="text-muted-foreground">Other:</span>
                      <div className="grid gap-1">
                        {(viewing.otherDocuments || []).map((d) => (
                          <a key={d.name + d.size} className="underline" href={d.dataUrl} target="_blank">{d.name}</a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] lg:max-w-[1200px] h-[85vh] max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="w-full max-w-[1200px] mx-auto">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Personal Information</h4>
                  <Separator className="mb-3" />
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        ID<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
                      {attempted && !form.id && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Name<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      {attempted && !form.name && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Email<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      {attempted && !form.email && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Phone<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      {attempted && !form.phone && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Date of Birth<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.dob || ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                      {attempted && !form.dob && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1 md:col-span-2">
                      <label className="text-xs text-muted-foreground">
                        Address<span className="text-destructive">*</span>
                      </label>
                      <Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                      {attempted && !form.address && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Marital Status<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.maritalStatus || ""} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })} />
                      {attempted && !form.maritalStatus && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Emergency Contact Name<span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={form.emergencyContactName || ""}
                        onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                      />
                      {attempted && !form.emergencyContactName && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Emergency Contact Phone<span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={form.emergencyContactPhone || ""}
                        onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                      />
                      {attempted && !form.emergencyContactPhone && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        National ID Number<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.nationalId || ""} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
                      {attempted && !form.nationalId && <span className="text-xs text-destructive">Required</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Employment Details</h4>
                  <Separator className="mb-3" />
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Department<span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={form.departmentId || undefined}
                        onValueChange={(v) => {
                          const d = departments.find((x) => x.id === v);
                          setForm({ ...form, departmentId: v, department: d?.name });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {attempted && !form.departmentId && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Designation<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
                      {attempted && !form.designation && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Joining Date<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.joiningDate || ""} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
                      {attempted && !form.joiningDate && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Salary<span className="text-destructive">*</span>
                      </label>
                      <Input value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                      {attempted && !form.salary && <span className="text-xs text-destructive">Required</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Documents</h4>
                  <Separator className="mb-3" />
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        CV (PDF/Image)<span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) toDoc(f, (d) => setForm({ ...form, cv: d }));
                        }}
                      />
                      {form.cv && (
                        <div className="flex items-center gap-2 text-xs">
                          {form.cv.type.startsWith("image/") ? (
                            <a href={form.cv.dataUrl} target="_blank" title={form.cv.name}>
                              <img src={form.cv.dataUrl} alt="cv" className="h-12 w-12 object-cover border rounded" />
                            </a>
                          ) : (
                            <a className="underline" href={form.cv.dataUrl} target="_blank">{form.cv.name}</a>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setForm({ ...form, cv: null })}>Remove</Button>
                        </div>
                      )}
                      {attempted && !form.cv && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        Qualifications (PDF/Image)<span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) toDoc(f, (d) => setForm({ ...form, qualifications: d }));
                        }}
                      />
                      {form.qualifications && (
                        <div className="flex items-center gap-2 text-xs">
                          {form.qualifications.type.startsWith("image/") ? (
                            <a href={form.qualifications.dataUrl} target="_blank" title={form.qualifications.name}>
                              <img src={form.qualifications.dataUrl} alt="qualifications" className="h-12 w-12 object-cover border rounded" />
                            </a>
                          ) : (
                            <a className="underline" href={form.qualifications.dataUrl} target="_blank">{form.qualifications.name}</a>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setForm({ ...form, qualifications: null })}>Remove</Button>
                        </div>
                      )}
                      {attempted && !form.qualifications && <span className="text-xs text-destructive">Required</span>}
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">
                        ID Copy (PDF/Image)<span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) toDoc(f, (d) => setForm({ ...form, idCopy: d }));
                        }}
                      />
                      {form.idCopy && (
                        <div className="flex items-center gap-2 text-xs">
                          {form.idCopy.type.startsWith("image/") ? (
                            <a href={form.idCopy.dataUrl} target="_blank" title={form.idCopy.name}>
                              <img src={form.idCopy.dataUrl} alt="id" className="h-12 w-12 object-cover border rounded" />
                            </a>
                          ) : (
                            <a className="underline" href={form.idCopy.dataUrl} target="_blank">{form.idCopy.name}</a>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setForm({ ...form, idCopy: null })}>Remove</Button>
                        </div>
                      )}
                      {attempted && !form.idCopy && <span className="text-xs text-destructive">Required</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-md border p-3 bg-secondary/30">
                  <p className="text-sm mb-2 font-medium">Completion</p>
                  <p className="text-xs text-muted-foreground">
                    All fields marked with <span className="text-destructive">*</span> are required to onboard an employee.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background border-t mt-4 py-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!allRequiredPresent()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Document Vault */}
      {viewing && (
        <EmployeeDocumentVault employeeId={viewing.id} />
      )}
    </div>
  );
};

export default HRMEmployees;

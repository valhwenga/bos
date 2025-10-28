import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HRMStore, type Employee, type EmployeeDocument } from "@/lib/hrmStore";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HRMDepartmentsStore, type Department } from "@/lib/hrmDepartmentsStore";
import { Separator } from "@/components/ui/separator";

const HRMEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>(HRMStore.list());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Employee>({ id: "", name: "", status: "Active", cv: null, qualifications: null, idCopy: null, otherDocuments: [] });
  const [departments, setDepartments] = useState<Department[]>(HRMDepartmentsStore.list());
  const [attempted, setAttempted] = useState(false);

  const refresh = () => setEmployees(HRMStore.list());
  useEffect(()=>{
    // migrate departmentId for existing employees
    const deps = HRMDepartmentsStore.list();
    const map: Record<string,string> = Object.fromEntries(deps.map(d=> [d.name, d.id]));
    HRMStore.migrateDepartmentIds(map);
    refresh();
  }, []);

  const startAdd = () => { setEditing(null); setForm({ id: `EMP${Math.floor(Math.random()*900+100)}`, name: "", status: "Active", cv: null, qualifications: null, idCopy: null, otherDocuments: [] }); setDepartments(HRMDepartmentsStore.list()); setAttempted(false); setOpen(true); };
  const startEdit = (e: Employee) => { setEditing(e); setForm(e); setOpen(true); };
  const remove = (id: string) => { HRMStore.remove(id); refresh(); };
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
    HRMStore.upsert({ ...form });
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
                    <span className="text-sm font-medium">{employee.salary}</span>
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
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
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
          <span>Showing 1 to 6 of 6 entries</span>
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
    </div>
  );
};

export default HRMEmployees;

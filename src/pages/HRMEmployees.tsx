import { useState, useMemo, useEffect } from "react";
import { HRMStore } from "@/lib/hrmStore";
import { useCache } from "@/lib/collectionCache";
import { employeesCache } from "@/lib/hrmStore";
import { departmentsCache } from "@/lib/hrmDepartmentsStore";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Download, Upload, Eye, Edit, Trash2, Trash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserCheck, Building2 } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CompanySettingsStore } from "@/lib/companySettings";
import type { Employee, EmployeeDocument } from "@/lib/hrmStore";
import { acceptFile, FileTooLargeError, safeSetItem } from "@/lib/fileStorage";
import { toast } from "@/components/ui/use-toast";

// Simple local HRM store to replace CompanyAwareHRMStore
/**
 * This page kept its own employee store on the key `hrm_employees`, while the
 * rest of the app read `hrm.employees` through HRMStore — so employees added
 * here were invisible to payroll, leave and the dashboard, and vice versa. Both
 * are now the same Postgres table.
 */
const LocalHRMStore = HRMStore;

import { EmployeeDocumentVault } from "@/components/EmployeeDocumentVault";
import { Textarea } from "@/components/ui/textarea";
import { HRMDepartmentsStore, type Department } from "@/lib/hrmDepartmentsStore";
import { Separator } from "@/components/ui/separator";

const HRMEmployees = () => {
  // Rows come from Postgres via a cache, so this re-renders when they arrive.
  const { rows: employees } = useCache(employeesCache);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [form, setForm] = useState<Employee>({ id: "", name: "", status: "Active", cv: null, qualifications: null, idCopy: null, otherDocuments: [] });
  // Departments come from the same cache, so the picker and the table's
  // department column populate as soon as they load.
  const { rows: departments } = useCache(departmentsCache);
  const [attempted, setAttempted] = useState(false);
  const cs = CompanySettingsStore.get();

  const totalEntries = employees.length;
  const showingFrom = totalEntries === 0 ? 0 : 1;
  const showingTo = totalEntries;

  const refresh = () => { void employeesCache.refresh(); };
  useEffect(() => {
    // Departments are needed for the form's picker and for showing an
    // employee's department name.
    void HRMDepartmentsStore.load();
  }, []);

  const startAdd = () => { setEditing(null); setForm({ id: `EMP${Math.floor(Math.random()*900+100)}`, name: "", status: "Active", cv: null, qualifications: null, idCopy: null, otherDocuments: [] }); setAttempted(false); setOpen(true); };
  const startEdit = (e: Employee) => { setEditing(e); setForm(e); setOpen(true); };
  const remove = (id: string) => {
    const ok = window.confirm("Delete this employee? This action cannot be undone.");
    if (!ok) return;
    void LocalHRMStore.remove(id).catch((err: unknown) =>
      toast({
        title: "Could not delete the employee",
        description: err instanceof Error ? err.message : "The record is unchanged.",
        variant: "destructive",
      }),
    );
  };
  const allRequiredPresent = () => {
    const f = form;
    return Boolean(
      f.id && f.name && f.email && f.phone && f.departmentId && f.designation && f.joiningDate && f.salary &&
      f.dob && f.address && f.maritalStatus && f.emergencyContactName && f.emergencyContactPhone && f.nationalId &&
      (editing ? true : (f.cv && f.qualifications && f.idCopy))
    );
  };
  const save = async () => {
    setAttempted(true);
    if (!allRequiredPresent()) return;
    try {
      await LocalHRMStore.upsert({ ...form });
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Saving this employee failed.",
        variant: "destructive",
      });
      return;
    }
    setOpen(false);
    refresh();
  };

  /**
   * Employee records hold three documents each (CV, qualifications, ID copy),
   * so this is the fastest way to exhaust browser storage. acceptFile refuses
   * a file that would do so and explains why, rather than letting the save
   * throw QuotaExceededError and lose the record.
   */
  const toDoc = async (f: File, cb: (d: EmployeeDocument) => void) => {
    try {
      const stored = await acceptFile("employee-documents", f);
      cb({ name: stored.name, type: stored.type, size: stored.size, dataUrl: stored.dataUrl ?? "" });
    } catch (err) {
      toast({
        title: err instanceof FileTooLargeError ? "File too large" : "Storage full",
        description: err instanceof Error ? err.message : "That file could not be attached.",
        variant: "destructive",
      });
    }
  };
  const columns: Column<Employee>[] = [
    {
      id: "employee",
      header: "Employee",
      sortValue: (e) => e.name,
      cell: (e) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-2xs font-medium text-primary-foreground">
              {e.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{e.name}</span>
            <span className="text-xs text-muted-foreground">{e.id}</span>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      hideOnMobile: true,
      sortValue: (e) => e.email ?? "",
      cell: (e) => (
        <div className="flex flex-col text-xs">
          <span className="text-foreground">{e.email || "—"}</span>
          <span className="text-muted-foreground">{e.phone || ""}</span>
        </div>
      ),
    },
    {
      id: "department",
      header: "Department",
      // Resolved from departmentId rather than the name copied onto the record,
      // which only ever got set when the form wrote it — so an employee created
      // any other way showed a dash.
      sortValue: (e) => departmentName(e) ?? "",
      cell: (e) => departmentName(e) || <span className="text-subtle">—</span>,
    },
    { id: "designation", header: "Designation", hideOnMobile: true, sortValue: (e) => e.designation ?? "", cell: (e) => e.designation || <span className="text-subtle">—</span> },
    { id: "joined", header: "Joined", hideOnMobile: true, sortValue: (e) => e.joiningDate ?? "", cell: (e) => e.joiningDate || <span className="text-subtle">—</span> },
    {
      id: "salary",
      header: "Salary",
      align: "right",
      hideOnMobile: true,
      sortValue: (e) => parseFloat(String(e.salary ?? "").replace(/[^0-9.]/g, "")) || 0,
      cell: (e) => (e.salary ? `${cs.currencySymbol}${String(e.salary).replace(/[^0-9.,\s-]/g, "").trim()}` : "—"),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (e) => e.status ?? "",
      cell: (e) => (
        <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-xs font-medium ${e.status === "Active" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          {e.status || "Unknown"}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      width: "1%",
      cell: (e) => (
        <div className="inline-flex items-center justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setViewing(e); setViewOpen(true); }} aria-label={`View ${e.name}`}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(e)} aria-label={`Edit ${e.name}`}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => remove(e.id)} aria-label={`Delete ${e.name}`}>
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = employees.filter((e) => e.status === "Active").length;
  const departmentName = (e: Employee) =>
    departments.find((d) => d.id === e.departmentId)?.name ?? e.department;

  const departmentCount = new Set(employees.map((e) => e.departmentId || e.department).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Employees"
        description="Everyone on the team, their role and where they sit."
        breadcrumbs={[{ label: "HRM", to: "/hrm/employees" }, { label: "Employees" }]}
        actions={
          <Button onClick={startAdd}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add employee
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Employees" value={employees.length} hint="On the books" icon={Users} />
          <StatCard label="Active" value={activeCount} hint={`${employees.length - activeCount} inactive`} icon={UserCheck} tone="success" />
          <StatCard label="Departments" value={departmentCount} hint="Represented across the team" icon={Building2} />
        </div>
      </PageHeader>

      <DataTable
        rows={employees}
        columns={columns}
        rowKey={(e) => e.id}
        searchAccessor={(e) => `${e.name} ${e.id} ${e.email ?? ""} ${departmentName(e) ?? ""} ${e.designation ?? ""}`}
        searchPlaceholder="Search by name, department or role…"
        onRowClick={(e) => { setViewing(e); setViewOpen(true); }}
        empty={{
          title: "No employees yet",
          description: "Add your first employee to start tracking attendance, leave and payroll.",
          action: <Button onClick={startAdd}>Add employee</Button>,
        }}
      />

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
            <Button onClick={() => void save()} disabled={!allRequiredPresent()}>
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
